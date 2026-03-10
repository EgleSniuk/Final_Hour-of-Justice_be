import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    answer_text: { type: String, required: true, trim: true, minlength: 2 },
    question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

answerSchema.virtual('gained_likes_number').get(function gainedLikesNumber() {
  return this.likes.length;
});

const Answer = mongoose.model('Answer', answerSchema);

export default Answer;
