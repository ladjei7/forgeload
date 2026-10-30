"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import ExercisePicker from '../components/ExercisePicker';

export default function PlanPage() {
  const [planName, setPlanName] = useState("");
  const [dayName, setDayName] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [targetSets, setTargetSets] = useState("");
  const [repMin, setRepMin] = useState("");
  const [repMax, setRepMax] = useState("");
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [currentDayId, setCurrentDayId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function createPlan() {
    if (!planName) return;
    const { data, error } = await supabase
      .from("workout_plans")
      .insert([{ name: planName }])
      .select()
      .single();
    if (error) {
      setMessage("Error: " + error.message);
      return;
    }
    setCurrentPlanId(data.id);
    setMessage("Plan created: " + data.name);
  }

  async function addDay() {
    if (!dayName || !currentPlanId) return;
    const { data, error } = await supabase
      .from("workout_days")
      .insert([{ plan_id: currentPlanId, day_name: dayName, sort_order: 0 }])
      .select()
      .single();
    if (error) {
      setMessage("Error: " + error.message);
      return;
    }
    setCurrentDayId(data.id);
    setMessage("Day added: " + data.day_name);
  }

  async function addExercise() {
    if (!exerciseName || !currentDayId) return;
    const { error } = await supabase.from("plan_exercises").insert([
      {
        workout_day_id: currentDayId,
        exercise_name: exerciseName,
        target_sets: parseInt(targetSets),
        rep_min: parseInt(repMin),
        rep_max: parseInt(repMax),
        sort_order: 0,
      },
    ]);
    if (error) {
      setMessage("Error: " + error.message);
      return;
    }
    setMessage("Exercise added: " + exerciseName);
    setExerciseName("");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "2rem",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "2rem" }}
      >
        Build Your Plan
      </h1>

      {/* Step 1 - Create Plan */}
      <div
        style={{
          background: "#111",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.2rem",
            fontWeight: "bold",
            marginBottom: "1rem",
          }}
        >
          Step 1 — Name Your Plan
        </h2>
        <input
          type="text"
          placeholder="e.g. Push Pull Legs"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "8px",
            border: "1px solid #333",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: "16px",
            marginBottom: "0.75rem",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={createPlan}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "8px",
            background: "#fff",
            color: "#000",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: "pointer",
            border: "none",
          }}
        >
          Create Plan
        </button>
      </div>

      {/* Step 2 - Add Day */}
      {currentPlanId && (
        <div
          style={{
            background: "#111",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              marginBottom: "1rem",
            }}
          >
            Step 2 — Add a Training Day
          </h2>
          <input
            type="text"
            placeholder="e.g. Monday - Push"
            value={dayName}
            onChange={(e) => setDayName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: "16px",
              marginBottom: "0.75rem",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={addDay}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              background: "#fff",
              color: "#000",
              fontWeight: "bold",
              fontSize: "16px",
              cursor: "pointer",
              border: "none",
            }}
          >
            Add Day
          </button>
        </div>
      )}

      {/* Step 3 - Add Exercise */}
      {currentDayId && (
        <div
          style={{
            background: "#111",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              marginBottom: "1rem",
            }}
          >
            Step 3 — Add Exercises
          </h2>
          <ExercisePicker value={exerciseName} onChange={setExerciseName} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            {[
              { label: "Sets", value: targetSets, set: setTargetSets },
              { label: "Min reps", value: repMin, set: setRepMin },
              { label: "Max reps", value: repMax, set: setRepMax },
            ].map((f) => (
              <div key={f.label} style={{ minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    color: "#888",
                    fontSize: "12px",
                    marginBottom: "4px",
                  }}
                >
                  {f.label}
                </label>
                <input
                  type="number"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    background: "#1a1a1a",
                    color: "#fff",
                    fontSize: "16px",
                  }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={addExercise}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              background: "#fff",
              color: "#000",
              fontWeight: "bold",
              fontSize: "16px",
              cursor: "pointer",
              border: "none",
            }}
          >
            Add Exercise
          </button>
        </div>
      )}

      {message && (
        <div
          style={{
            background: "#1a1a1a",
            borderRadius: "8px",
            padding: "1rem",
            marginTop: "1rem",
            color: "#4ade80",
            fontSize: "14px",
          }}
        >
          {message}
        </div>
      )}
    </main>
  );
}
