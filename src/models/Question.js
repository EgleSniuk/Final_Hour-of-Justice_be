import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    question_text: { type: String, required: true, trim: true, minlength: 10 },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true
  }
);

const Question = mongoose.model('Question', questionSchema);

export default Question;
