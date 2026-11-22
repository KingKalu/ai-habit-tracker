import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import AiInsight from "../models/AiInsight.js";
import { chatCompletion, SYSTEM_PROMPTS } from "../utils/aiService.js";
import { lastNDays, calcStreak, todayKey } from "../utils/dateHelpers.js;";

const buildWeeklyContext = async (userId) => {
  const habits = await Habit.find({ userId, isArchived: false });
  const days = lastNDays(7);
  const logs = await HabitLog.find({
    userId,
    completedDate: { $gte: days[0], $lte: days[days.length - 1] },
  });
  const perHabit = habits.map((h) => {
    const completed = logs.filter(
      (l) => String(l.habitId) === String(h._id),
    ).length;

    return {
      name: h.name,
      category: h.category,
      frequency: h.frequency,
      completedDays: completed,
      targetdDays: h.targetDays,
    };
  });

  return (days, perHabit);
};

export const weeklyReport = async (req, res) => {
  try {
    const ctx = await buildWeeklyContext(req.user._id);
    if (!ctx.perHabit.length) {
      return res.json({
        content:
          "You don't have any active habits yet. Create your first habit to start tracking - I'll generate a weekly report once you have some data.",
      });
    }
    const userMsg = `Here is the user's habit data for the past 7 days ($ctx.days[0] to $ctx.days[6]}):\n\n${ctx.perHabit.map((h) => `- ${h.name} (${h.category}, ${h.frequency}): completed ${h.completedDays} of the past 7 days, target ${h.targetDays}/weeks`).join("\n")}\n\nPlease write the personalized weekly report now.`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.weekly,
      user: userMsg,
    });

    await AiInsight.create({
      userId: req.user._id,
      type: "weekly",
      content,
    });

    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const suggestHabits = async (req, res) => {
  try {
    const { goals, productiveTime, struggles } = req.body;
    const userMsg = `User's goals: ${goals || "not provided"}\nMost productive time: ${productiveTime || "not provided"}\nPast struggles || ${struggles || "not provided"}\n\nSuggest 3 personalized habits now. Return JSON only.`;

    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.suggestion,
      user: userMsg,
    });

    let suggestions = [];
    try {
      const parsed = JSON.parse(content.replace(/```json/g, "").trim());
      suggestions = parsed.suggestions || [];
    } catch {
      suggestions = [];
    }

    if (!suggestions.length) {
      suggestions = [
        {
          name: "10-minute morning walk",
          description: "Start the day with light movement and fresh air.",
          frequency: "daily",
          category: "Fitness",
          icon: "🧘‍♂️",
          reason: "Low-friction way to build consistency early in the day.",
        },
        {
          name: "Read 5 pages",
          description: "Short daily reading to build a learning routine.",
          frequency: "daily",
          category: "Learning",
          icon: "📚",
          reason: "Compounds into significant knowledge over weeks.",
        },
        {
          name: "2 minutes of mindful breathing",
          description: "Pause and breathe to reset focus and reduce stress.",
          frequency: "daily",
          category: "Mindfullness",
          icon: "",
          reason: "Tiny ancho habit that fits any schedule.",
        },
      ];
    }
    await AiInsight.create({
      userId: req.user._id,
      type: "suggestion",
      content: JSON.stringify(suggestions),
      meta: { goal, productiveTime, struggles },
    });
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const recoveryPlan = async (req, res) => {
  try {
    const { habitId } = req.body;
    const habit = Habit.findOne({
      _id: habitId,
      userId: req.user._id,
    });
    if (!habit) return res.status(404).json({ message: "Habit not found" });

    const logs = await HabitLog.find({
      userId: req.user._id,
      habitId,
    }).sort({ completedDate: -1 });
    const keys = logs.map((l) => l.completedDate);
    const { current, longest } = calcStreak(keys);

    const userMsg = `Habit: ${habit.name} (${habit.category}).\nDescription: ${habit.description || "none"}.\nCurrent streak: ${current} days. Longest ever: ${longest} days. The user just broke a streak. Write a warm, actionable 3-day recovery plan.`;
    const { content } = await chatCompletion({
      system: SYSTEM_PROMPTS.recovery,
      user: userMsg,
    });
    await AiInsight.create({
      userId: req.user._id,
      type: "recovery",
      content,
      meta: { habitId },
    });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


