"use client";

import { useState } from "react";
import StarRating from "./StarRating";
import { supabase } from "@/lib/supabase";
import { sanitizeText } from "@/lib/geo";
import { toast } from "sonner";

interface ReviewFormProps {
  toiletId: string;
  onSubmitted: () => void;
}

export default function ReviewForm({ toiletId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    if (honeypot) return;

    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      toilet_id: toiletId,
      rating,
      body: body.trim() ? sanitizeText(body) : null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Failed to submit review");
      return;
    }
    toast.success("Review submitted!");
    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#f2f4f6]/50 p-5 rounded-3xl">
      <h3 className="text-[14px] font-bold text-[#191c1e] mb-4">How was your visit?</h3>
      <div className="mb-4">
        <StarRating rating={rating} size="lg" interactive onChange={setRating} />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="How was it? (optional)"
        maxLength={1000}
        rows={3}
        className="w-full bg-white border-0 rounded-2xl p-4 text-[14px] placeholder:text-zinc-400 focus:ring-2 focus:ring-[#22c55e]/20 mb-4 resize-none"
      />
      {/* Honeypot */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="absolute -left-[9999px]"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button
        type="submit"
        disabled={submitting || rating === 0}
        className="w-full bg-[#006e2f] text-white font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
