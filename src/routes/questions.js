import express from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';

const router = express.Router();

router.get('/questions', async (req, res) => {
  try {
    const { status } = req.query;

    const questions = await Question.find()
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const questionIds = questions.map((question) => question._id);
    const counts = await Answer.aggregate([
      { $match: { question_id: { $in: questionIds } } },
      { $group: { _id: '$question_id', answerCount: { $sum: 1 } } }
    ]);

    const countMap = new Map(counts.map((entry) => [entry._id.toString(), entry.answerCount]));

    const mapped = questions.map((question) => ({
      id: question._id,
      question_text: question.question_text,
      date: question.createdAt,
      user_id: question.user_id?._id,
      user_name: question.user_id?.name,
      answer_count: countMap.get(question._id.toString()) || 0
    }));

    const filtered =
      status === 'answered'
        ? mapped.filter((question) => question.answer_count > 0)
        : status === 'unanswered'
        ? mapped.filter((question) => question.answer_count === 0)
        : mapped;

    return res.json(filtered);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/question', requireAuth, async (req, res) => {
  try {
    const { question_text } = req.body;

    if (!question_text || question_text.trim().length < 10) {
      return res.status(400).json({ message: 'Question must be at least 10 characters long' });
    }

    const question = await Question.create({
      question_text: question_text.trim(),
      user_id: req.user.id
    });

    return res.status(201).json({
      id: question._id,
      question_text: question.question_text,
      date: question.createdAt,
      user_id: question.user_id
    });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/question/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid question id' });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    if (question.user_id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await Answer.deleteMany({ question_id: id });
    await question.deleteOne();

    return res.json({ message: 'Question deleted' });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/question/:id/answers', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid question id' });
    }

    const answers = await Answer.find({ question_id: id })
      .populate('user_id', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const mapped = answers.map((answer) => ({
      id: answer._id,
      answer_text: answer.answer_text,
      date: answer.createdAt,
      question_id: answer.question_id,
      user_id: answer.user_id?._id,
      user_name: answer.user_id?.name,
      gained_likes_number: answer.likes?.length || 0,
      gained_dislikes_number: answer.dislikes?.length || 0,
      likes: answer.likes || [],
      dislikes: answer.dislikes || []
    }));

    return res.json(mapped);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/question/:id/answers', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { answer_text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid question id' });
    }

    if (!answer_text || answer_text.trim().length < 2) {
      return res.status(400).json({ message: 'Answer must be at least 2 characters long' });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const answer = await Answer.create({
      answer_text: answer_text.trim(),
      question_id: id,
      user_id: req.user.id,
      likes: [],
      dislikes: []
    });

    return res.status(201).json({
      id: answer._id,
      answer_text: answer.answer_text,
      date: answer.createdAt,
      question_id: answer.question_id,
      user_id: answer.user_id,
      gained_likes_number: 0,
      gained_dislikes_number: 0
    });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/answer/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid answer id' });
    }

    const answer = await Answer.findById(id);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    if (answer.user_id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await answer.deleteOne();

    return res.json({ message: 'Answer deleted' });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/answer/:id/reaction', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid answer id' });
    }

    if (!['like', 'dislike'].includes(type)) {
      return res.status(400).json({ message: 'Reaction type must be like or dislike' });
    }

    const answer = await Answer.findById(id);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const userId = req.user.id;

    answer.likes = answer.likes.filter((entry) => entry.toString() !== userId);
    answer.dislikes = answer.dislikes.filter((entry) => entry.toString() !== userId);

    if (type === 'like') {
      answer.likes.push(userId);
    } else {
      answer.dislikes.push(userId);
    }

    await answer.save();

    return res.json({
      id: answer._id,
      gained_likes_number: answer.likes.length,
      gained_dislikes_number: answer.dislikes.length
    });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
