import mongoose from "mongoose";

const habitLogSchema = new mongoose.Schema({
    userId: {
        ref: "User",
        required: true,
        index: true,
    },
    habitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Habit",
        required: true,
        index: true,
    },
    completedDate: {
        type: String,
        required: true,
    },
    notes: {
        type: String,
        default: "",
    },
}, { timestamps: true });   