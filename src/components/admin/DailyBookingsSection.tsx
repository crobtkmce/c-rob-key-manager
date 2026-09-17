import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  isSameDay,
  isPast,
  isToday,
  isFuture,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";

export function DailyBookingsSection() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const {
    data: bookings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin_daily_bookings", selectedDate.toISOString()],
    queryFn: async () => {
      const start = startOfDay(selectedDate).toISOString();
      const end = endOfDay(selectedDate).toISOString();

      let validStatuses = ["confirmed"];
      if (isPast(selectedDate) && !isToday(selectedDate)) {
        // Past dates: approved/accepted and completed normally
        validStatuses = ["confirmed", "completed"];
      } else if (isToday(selectedDate)) {
        // Today: accepted/approved (and completed if finished early)
        validStatuses = ["confirmed", "completed"];
      } else if (isFuture(selectedDate)) {
        // Future: only accepted/approved (not completed yet)
        validStatuses = ["confirmed"];
      }

      if (!supabase) throw new Error("No supabase");
      const { data, error } = await supabase
        .from("bookings")
        .select("*, profiles(full_name, email)")
        .gte("start_time", start)
        .lte("start_time", end)
        .in("status", validStatuses)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const handleToday = () => setSelectedDate(new Date());

  return (
    <Card className="panel fade-up">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CardTitle>Bookings by Date</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            disabled={isToday(selectedDate)}
          >
            Today
          </Button>
        </div>
        <div className="flex items-center gap-4 bg-card/40 border border-border/50 rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center text-sm font-medium">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            {format(selectedDate, "MMM d, yyyy")}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto bg-card/20 rounded-md border border-border/30">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="animate-pulse">
                  <TableCell colSpan={5} className="text-center h-24">
                    Loading bookings...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-destructive">
                    Failed to load bookings.
                  </TableCell>
                </TableRow>
              ) : bookings && bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    No approved bookings for this date.
                  </TableCell>
                </TableRow>
              ) : (
                bookings?.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap font-medium text-sm">
                      {format(new Date(b.start_time), "h:mm a")} -{" "}
                      {format(
                        new Date(
                          new Date(b.start_time).getTime() + b.duration_hours * 60 * 60 * 1000,
                        ),
                        "h:mm a",
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {b.profiles?.full_name || "Unknown User"}
                      </div>
                      {b.team_size > 1 && (
                        <div className="text-xs text-muted-foreground">
                          Team Size: {b.team_size}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm">{b.booking_type}</span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={b.purpose}>
                      {b.purpose || "N/A"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs uppercase font-bold tracking-wider px-2 py-1 rounded-md border ${
                          b.status === "completed"
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-warning/20 text-warning border-warning/30"
                        }`}
                      >
                        {b.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
