"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import AmenityTag from "./AmenityTag";
import StarRating from "./StarRating";
import ReviewForm from "./ReviewForm";
import { supabase } from "@/lib/supabase";
import { formatDistance, estimateWalkingTime } from "@/lib/geo";
import type { Toilet, Review } from "@/lib/types";

interface ToiletDetailProps {
  toilet: Toilet | null;
  userLat: number | null;
  userLng: number | null;
  onClose: () => void;
}

export default function ToiletDetail({
  toilet,
  userLat,
  userLng,
  onClose,
}: ToiletDetailProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [localToilet, setLocalToilet] = useState<Toilet | null>(toilet);

  useEffect(() => {
    setLocalToilet(toilet);
    setShowReviewForm(false);
  }, [toilet]);

  const fetchReviews = useCallback(async () => {
    if (!toilet) return;
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("toilet_id", toilet.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setReviews(data);
  }, [toilet]);

  const refreshToilet = useCallback(async () => {
    if (!toilet) return;
    const { data } = await supabase
      .from("toilets")
      .select("*")
      .eq("id", toilet.id)
      .single();
    if (data) {
      setLocalToilet((prev) =>
        prev ? { ...prev, avg_rating: data.avg_rating, review_count: data.review_count } : prev
      );
    }
  }, [toilet]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  if (!localToilet) return null;

  const displayName = localToilet.name || `${localToilet.type.replace("_", " ")} toilet`;
  const directionsUrl =
    userLat && userLng
      ? `https://www.google.com/maps/dir/${userLat},${userLng}/${localToilet.lat},${localToilet.lng}/@${localToilet.lat},${localToilet.lng},17z/data=!4m2!4m1!3e2`
      : `https://www.google.com/maps/search/?api=1&query=${localToilet.lat},${localToilet.lng}`;

  function formatReviewDate(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  return (
    <Drawer open={!!toilet} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85dvh] rounded-t-[2.5rem] shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.15)]">
        {/* Grab Handle */}
        <div className="w-full flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-[#e0e3e5] rounded-full"></div>
        </div>

        <div className="overflow-y-auto hide-scrollbar px-6 pb-24">
          <DrawerHeader className="px-0 pt-2">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <DrawerTitle className="text-left text-[18px] font-bold text-[#191c1e] leading-tight tracking-tight uppercase">
                {displayName}
              </DrawerTitle>
              <DrawerDescription className="sr-only">Details for {displayName}</DrawerDescription>
              <span className={`font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full ${
                localToilet.is_free
                  ? "bg-[#22c55e]/20 text-[#006e2f]"
                  : "bg-[#d7a400]/20 text-[#785a00]"
              }`}>
                {localToilet.is_free ? "Free" : `₹${localToilet.price_inr ?? "?"}`}
              </span>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#3d4a3d] text-[14px] font-medium">
                {localToilet.distance_m != null && (
                  <>{formatDistance(localToilet.distance_m)} · {estimateWalkingTime(localToilet.distance_m)} · </>
                )}
              </span>
              <div className="flex items-center gap-1">
                <StarRating rating={localToilet.avg_rating} size="sm" />
                <span className="text-[#3d4a3d] text-[14px] font-medium ml-1">({localToilet.review_count})</span>
              </div>
            </div>

            {localToilet.opening_hours && (
              <p className="text-[#3d4a3d] text-[12px] font-medium">
                Hours: {localToilet.opening_hours}
              </p>
            )}
          </DrawerHeader>

          {localToilet.description && (
            <p className="text-sm text-[#3d4a3d] mb-4">{localToilet.description}</p>
          )}

          {/* Amenities */}
          {localToilet.amenities.length > 0 && (
            <section className="mt-4">
              <h3 className="text-[14px] font-bold text-[#191c1e] mb-3 tracking-wide uppercase">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {localToilet.amenities.map((a) => (
                  <AmenityTag key={a} amenity={a} />
                ))}
              </div>
            </section>
          )}

          {/* Action Buttons */}
          <section className="mt-8 grid grid-cols-2 gap-3">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-gradient-to-br from-[#006e2f] to-[#22c55e] text-white py-3.5 rounded-xl font-bold shadow-sm active:scale-95 transition-transform h-12"
            >
              <span className="material-symbols-outlined text-[20px]">directions</span>
              <span className="text-[14px]">Get Directions</span>
            </a>
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="flex items-center justify-center gap-2 bg-white border border-[#bccbb9]/30 text-[#3d4a3d] py-3.5 rounded-xl font-bold active:scale-95 transition-transform h-12"
            >
              <span className="material-symbols-outlined text-[20px]">edit</span>
              <span className="text-[14px]">Write a Review</span>
            </button>
          </section>

          {/* Review form */}
          {showReviewForm && (
            <section className="mt-8">
              <ReviewForm
                toiletId={localToilet.id}
                onSubmitted={() => {
                  setShowReviewForm(false);
                  fetchReviews();
                  refreshToilet();
                }}
              />
            </section>
          )}

          {/* Reviews Feed */}
          {reviews.length > 0 && (
            <section className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-bold text-[#191c1e] uppercase tracking-wide">Recent Reviews</h3>
              </div>
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-[#f2f4f6] p-4 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[14px] font-bold">Anonymous</span>
                      <StarRating rating={r.rating} size="sm" />
                    </div>
                    {r.body && (
                      <p className="text-[13px] text-[#3d4a3d] leading-relaxed">{r.body}</p>
                    )}
                    <span className="text-[10px] text-zinc-400 mt-2 block">
                      {formatReviewDate(r.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
