import { useQuery } from "@tanstack/react-query";
import {
  format,
  addDays,
  subDays,
  isSameDay,
  startOfDay,
  endOfDay,
  isBefore,
  isTomorrow,
} from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function DailySchedule() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expanded, setExpanded] = useState(false);

  const isToday = isSameDay(selectedDate, new Date());

  // Prevent navigating to the past
  const canGoBack = !isBefore(startOfDay(selectedDate), startOfDay(new Date())) && !isToday;

  const {
    data: schedule,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["schedule", selectedDate.toISOString()],
    queryFn: async () => {
      if (!supabase) return [];

      const rangeStart = startOfDay(selectedDate).toISOString();
      const rangeEnd = endOfDay(selectedDate).toISOString();

      // Uses the secure RPC function to fetch minimal public info (names and times)
      const { data, error } = await supabase.rpc("get_schedule_in_range", {
        range_start: rangeStart,
        range_end: rangeEnd,
      });

      if (error) {
        console.error("Failed to fetch schedule:", error);
        throw new Error(error.message);
      }
      return data || [];
    },
  });

  const handlePrevDay = () => {
    if (canGoBack) setSelectedDate(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const visibleBookings = expanded ? schedule : schedule?.slice(0, 3);
  const hasMore = schedule && schedule.length > 3;

  let titleText = "";
  if (isToday) {
    titleText = "Today's Bookings";
  } else if (isTomorrow(selectedDate)) {
    titleText = `Tomorrow — ${format(selectedDate, "MMM d")}`;
  } else {
    titleText = format(selectedDate, "MMM d");
  }

  return (
    <Card className="panel flex flex-col opacity-90 transition-all hover:opacity-100">
      <CardHeader className="pb-2 pt-4 border-b border-border/10">
        <div className="flex items-center justify-center relative w-full">
          <div className="absolute left-0 flex items-center justify-center">
            <CalendarIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 text-muted-foreground hover:text-foreground transition-opacity",
                !canGoBack && "opacity-0 pointer-events-none",
              )}
              onClick={handlePrevDay}
              disabled={!canGoBack}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[150px] text-center select-none">
              {titleText}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleNextDay}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-4 text-sm text-red-500 bg-red-500/10 rounded-md">
              Failed to fetch schedule: {(error as Error).message}
            </div>
          ) : !schedule || schedule.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground bg-muted/20 rounded-md">
              No bookings scheduled.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleBookings?.map((booking: any) => {
                const start = new Date(booking.start_time);
                const end = new Date(start.getTime() + booking.duration_hours * 3600000);
                const isOwnBooking = booking.user_id === user?.id;

                return (
                  <div
                    key={booking.id}
                    className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                      isOwnBooking
                        ? "bg-primary/5 border-primary/20"
                        : "bg-background border-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-medium tabular-nums text-foreground/90">
                        {format(start, "hh:mm a")} – {format(end, "hh:mm a")}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                        {booking.first_name || "Member"}
                        {isOwnBooking && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">
                            You
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!expanded && hasMore && (
                <div className="pt-2 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded(true)}
                  >
                    Show all {schedule.length} bookings ↓
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
