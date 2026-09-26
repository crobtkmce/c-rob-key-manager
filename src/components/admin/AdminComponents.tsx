import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { CalendarIcon, Download, Table2 } from "lucide-react";
import {
  startOfDay,
  addHours,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  isBefore,
} from "date-fns";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Box,
  Calendar,
  Users,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";

export function OverviewSection({
  onNavigate,
}: {
  onNavigate?: (tab: string, filter?: string) => void;
}) {
  const { data: currentSession, isLoading: isLoadingSession } = useQuery({
    queryKey: ["admin_current_session"],
    queryFn: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase
        .from("key_sessions")
        .select(
          "*, holder:profiles!current_holder(id, full_name, role, email), bookings(id, start_time, duration_hours, user_id, booker:profiles!user_id(id, full_name), team_size)",
        )
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error(error);
        return null;
      }
      return data || null;
    },
    refetchInterval: 10000,
  });

  const { data: usersCount, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin_users_count"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!supabase) return 0;
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "member");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: execomCount, isLoading: isLoadingExecom } = useQuery({
    queryKey: ["admin_execom_count"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!supabase) return 0;
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "execom");
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: bookingsStats, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["admin_bookings_stats"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.from("bookings").select("status");
      if (error) throw error;

      return {
        total: data.length,
        pending: data.filter((b) => b.status === "pending").length,
        active: data.filter((b) => b.status === "confirmed").length,
        completed: data.filter((b) => b.status === "completed").length,
        cancelled: data.filter((b) => b.status === "cancelled").length,
      };
    },
  });

  return (
    <div className="space-y-6">
      <Card
        className="panel border-primary/20 bg-background/50 fade-up"
        style={{ animationDelay: "0ms" }}
      >
        <CardHeader>
          <CardTitle>Current Ongoing Session</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingSession ? (
            <div className="animate-pulse text-sm text-muted-foreground">
              Loading session state...
            </div>
          ) : currentSession ? (
            <div className="space-y-2">
              <Badge className="bg-green-600 hover:bg-green-600 text-white">Session Active</Badge>
              <div className="text-sm mt-3 space-y-1">
                <p>
                  <span className="font-semibold text-muted-foreground">Source:</span>{" "}
                  {currentSession.bookings ? "Booking Session" : "Fingerprint Access Session"}
                </p>
                <p>
                  <span className="font-semibold text-muted-foreground">Member:</span>{" "}
                  {(currentSession.holder as any)?.full_name ||
                    (currentSession.holder as any)?.email}
                </p>
                <p>
                  <span className="font-semibold text-muted-foreground">Started:</span>{" "}
                  {format(new Date(currentSession.started_at), "PPp")}
                </p>
                {currentSession.bookings && (
                  <>
                    <p>
                      <span className="font-semibold text-muted-foreground">Expected End:</span>{" "}
                      {format(
                        addHours(
                          new Date((currentSession.bookings as any).start_time),
                          (currentSession.bookings as any).duration_hours,
                        ),
                        "PPp",
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-destructive font-semibold">No active sessions</p>
              <p className="text-sm text-muted-foreground mt-1">No sessions currently</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
        <Card
          className="panel bg-card/40 fade-up cursor-pointer hover:border-primary/50 hover:bg-card/60 transition-all active:scale-[0.98]"
          style={{ animationDelay: "0ms" }}
          onClick={() => onNavigate && onNavigate("members")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate && onNavigate("members")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoadingUsers ? "-" : usersCount}</div>
            <p className="text-xs text-muted-foreground">Registered in system</p>
          </CardContent>
        </Card>

        <Card
          className="panel bg-card/40 fade-up cursor-pointer hover:border-primary/50 hover:bg-card/60 transition-all active:scale-[0.98]"
          style={{ animationDelay: "50ms" }}
          onClick={() => onNavigate && onNavigate("execom")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate && onNavigate("execom")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ExeCom</CardTitle>
            <Users className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {isLoadingExecom ? "-" : execomCount}
            </div>
            <p className="text-xs text-muted-foreground">ExeCom members</p>
          </CardContent>
        </Card>

        <Card
          className="panel bg-card/40 fade-up cursor-pointer hover:border-primary/50 hover:bg-card/60 transition-all active:scale-[0.98]"
          style={{ animationDelay: "100ms" }}
          onClick={() => onNavigate && onNavigate("daily-bookings")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate && onNavigate("daily-bookings")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <Activity className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoadingBookings ? "-" : bookingsStats?.active}
            </div>
            <p className="text-xs text-muted-foreground">Currently confirmed slots</p>
          </CardContent>
        </Card>

        <Card
          className="panel bg-card/40 fade-up cursor-pointer hover:border-primary/50 hover:bg-card/60 transition-all active:scale-[0.98]"
          style={{ animationDelay: "150ms" }}
          onClick={() => onNavigate && onNavigate("bookings", "Pending")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate && onNavigate("bookings", "Pending")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Bookings</CardTitle>
            <Calendar className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {isLoadingBookings ? "-" : bookingsStats?.pending}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="panel fade-up" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle>Booking Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/10 pb-2">
                <span className="text-sm text-muted-foreground">Total Bookings</span>
                <span className="font-semibold">
                  {isLoadingBookings ? "-" : bookingsStats?.total}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-border/10 pb-2">
                <span className="text-sm text-muted-foreground">Pending Requests</span>
                <span className="font-semibold text-warning">
                  {isLoadingBookings ? "-" : bookingsStats?.pending}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-border/10 pb-2">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="font-semibold text-green-500">
                  {isLoadingBookings ? "-" : bookingsStats?.completed}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cancelled</span>
                <span className="font-semibold text-destructive">
                  {isLoadingBookings ? "-" : bookingsStats?.cancelled}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="panel opacity-70 fade-up" style={{ animationDelay: "250ms" }}>
          <CardHeader>
            <CardTitle>Locker Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Locker tracking not initialized. Wait for IoT synchronization to populate locker data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BookingsSection({ defaultStatus = "All" }: { defaultStatus?: string }) {
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { user, role } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const {
    data: bookings,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["admin_bookings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateBooking = useMutation({
    mutationFn: async ({
      id,
      status,
      oldStatus,
      actionName,
    }: {
      id: string;
      status: string;
      oldStatus: string;
      actionName: string;
    }) => {
      // 1. Update booking
      if (["confirmed", "entry_only", "cancelled"].includes(status)) {
        const { data, error } = await supabase!.functions.invoke("admin-booking-action", {
          body: { id, action: status },
        });
        if (error) { let errorMsg = error.message; if (error.context instanceof Response) { try { const errorData = await error.context.clone().json(); errorMsg = errorData.error || errorMsg; } catch (e) {} } throw new Error('Booking approval failed: ' + errorMsg); } if (data?.error) throw new Error('Booking approval failed: ' + data.error);
      } else {
        const { error: updateError } = await supabase!
          .from("bookings")
          .update({ status })
          .eq("id", id);
        if (updateError) throw updateError;
      }

      // 2. Create audit log
      if (user) {
        const { error: logError } = await supabase!.from("audit_logs").insert({
          action: `${actionName} (from ${oldStatus})`,
          booking_id: id,
          user_id: user.id,
        });
        if (logError) {
          console.error("Failed to insert audit log:", logError);
          // Don't fail the whole operation if logging fails, but log it to console
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin_bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin_bookings_stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin_audit_logs"] });
      toast.success(`Booking ${variables.status} successfully`);
      setProcessingId(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to update booking");
      setProcessingId(null);
    },
  });

  const handleAction = (b: any, newStatus: string, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setProcessingId(b.id);
    let actionName = "Booking Updated";
    if (newStatus === "confirmed") actionName = "Booking Approved";
    if (newStatus === "cancelled") actionName = "Booking Rejected";
    if (newStatus === "completed") actionName = "Booking Completed";

    updateBooking.mutate({ id: b.id, status: newStatus, oldStatus: b.status, actionName });
  };

  const filtered =
    bookings?.filter((b: any) => {
      const matchesSearch =
        b.id.toLowerCase().includes(search.toLowerCase()) ||
        b.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        b.profiles?.email?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Approved" && b.status === "confirmed") ||
        (statusFilter === "Rejected" && (b.status === "rejected" || b.status === "cancelled")) ||
        (statusFilter === "Pending" && b.status === "pending");

      return matchesSearch && matchesStatus;
    }) ?? [];

  return (
    <Card className="panel fade-up">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CardTitle>Booking Requests</CardTitle>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={async () => {
              try {
                await refetch();
              } catch (e) {
                toast.error("Failed to refresh bookings");
              }
            }}
            disabled={isRefetching}
            title="Refresh Booking Requests"
            aria-label="Refresh Booking Requests"
          >
            <RefreshCw className={cn("size-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search bookings..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-lg border border-border/50">
            {["All", "Pending", "Approved", "Entry Only", "Rejected"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  statusFilter === s
                    ? "bg-background shadow-sm text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto bg-card/20 rounded-md border border-border/30">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking Details</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Type & Purpose</TableHead>
                <TableHead>Status</TableHead>
                {role !== "execom" && <TableHead className="min-w-[180px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="animate-pulse">
                  <TableCell colSpan={5} className="text-center h-24">
                    Loading booking requests...
                  </TableCell>
                </TableRow>
              ) : bookings?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    No booking requests found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b: any) => {
                    const isProcessing = processingId === b.id;
                    const bStart = new Date(b.start_time).getTime();
                    const bEnd = bStart + b.duration_hours * 3600000;
                    const isOverlapping = bookings?.some((other: any) => {
                      if (other.id === b.id || other.status !== "confirmed") return false;
                      const oStart = new Date(other.start_time).getTime();
                      const oEnd = oStart + other.duration_hours * 3600000;
                      return bStart < oEnd && bEnd > oStart;
                    });

                    return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium">{format(new Date(b.start_time), "PPP")}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(b.start_time), "p")} ({b.duration_hours} hr)
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1" title={b.id}>
                          ID: {b.id.split("-")[0]}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70">
                          Created: {format(new Date(b.created_at), "MMM d, p")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {b.profiles?.full_name || "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.profiles?.email || b.user_id?.split("-")[0]}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="capitalize font-medium text-sm">
                          {b.booking_type || "Individual"}
                          {b.booking_type === "team" && (
                            <span className="block text-xs text-muted-foreground font-normal">
                              Members attending: {b.team_size || 1}
                            </span>
                          )}
                        </div>
                        {b.purpose && b.purpose !== "nil" && (
                          <div
                            className="text-xs text-muted-foreground/80 italic mt-1 max-w-[200px] truncate"
                            title={b.purpose}
                          >
                            "{b.purpose}"
                          </div>
                        )}
                        {(!b.purpose || b.purpose === "nil") && (
                          <div className="text-[10px] text-muted-foreground/50 mt-1 italic">
                            No purpose provided.
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            b.status === "confirmed"
                              ? "text-primary border-primary/30"
                              : b.status === "pending"
                                ? "text-warning border-warning/30"
                                : b.status === "cancelled"
                                  ? "text-destructive border-destructive/30"
                                  : b.status === "expired"
                                    ? "text-muted-foreground border-border/50"
                                    : "text-green-500 border-green-500/30"
                          }
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                      {role !== "execom" && (
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {b.status === "pending" && (
                                <>
                                  {!isOverlapping ? (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 text-[11px] px-2 bg-green-600 hover:bg-green-700 text-white border-0"
                                      onClick={() => handleAction(b, "confirmed")}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing && updateBooking.variables?.status === "confirmed" ? (
                                        <RefreshCw className="mr-1 size-3 animate-spin" />
                                      ) : (
                                        <CheckCircle className="mr-1 size-3" />
                                      )}
                                      Approve
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 text-[11px] px-2 bg-green-600 hover:bg-green-700 text-white border-0"
                                      onClick={() => handleAction(b, "entry_only")}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing && updateBooking.variables?.status === "entry_only" ? (
                                        <RefreshCw className="mr-1 size-3 animate-spin" />
                                      ) : (
                                        <CheckCircle className="mr-1 size-3" />
                                      )}
                                      Give Entry
                                    </Button>
                                  )}
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 text-[11px] px-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0"
                                    onClick={() => handleAction(b, "cancelled")}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing && updateBooking.variables?.status === "cancelled" ? (
                                      <RefreshCw className="mr-1 size-3 animate-spin" />
                                    ) : (
                                      <XCircle className="mr-1 size-3" />
                                    )}
                                    Reject
                                  </Button>
                                </>
                              )}

                            {b.status === "confirmed" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 border-green-500/30 text-green-500 hover:bg-green-500/10"
                                  onClick={() =>
                                    handleAction(b, "completed", "Mark this booking as completed?")
                                  }
                                  disabled={isProcessing}
                                >
                                  {isProcessing &&
                                  updateBooking.variables?.status === "completed" ? (
                                    <RefreshCw className="mr-1 size-3 animate-spin" />
                                  ) : (
                                    <Clock className="mr-1 size-3" />
                                  )}
                                  Complete
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                                  onClick={() =>
                                    handleAction(
                                      b,
                                      "cancelled",
                                      "Are you sure you want to cancel this approved booking?",
                                    )
                                  }
                                  disabled={isProcessing}
                                  title="Cancel Booking"
                                >
                                  {isProcessing &&
                                  updateBooking.variables?.status === "cancelled" ? (
                                    <RefreshCw className="size-3 animate-spin" />
                                  ) : (
                                    <XCircle className="size-3" />
                                  )}
                                </Button>
                              </>
                            )}

                            {(b.status === "completed" ||
                              b.status === "cancelled" ||
                              b.status === "entry_only" ||
                              b.status === "expired") && (
                              <span className="text-xs text-muted-foreground italic">
                                No actions available
                              </span>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 ml-auto"
                                  disabled={isProcessing}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled>View Details</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function DatePickerPopover({
  value,
  onChange,
  placeholder = "Select date",
}: {
  value: Date | undefined;
  onChange: (d?: Date) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal border-input bg-background hover:bg-accent hover:text-accent-foreground",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "d MMMM yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border bg-card shadow-lg" align="start">
        <ShadcnCalendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setIsOpen(false);
          }}
          initialFocus
          className="rounded-md border border-border/10"
        />
      </PopoverContent>
    </Popover>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

export * from "./UsersSection";

export function LockerStatusSection() {
  const {
    data: locker,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["admin_locker"],
    queryFn: async () => {
      if (!supabase) throw new Error("No supabase");
      const { data, error } = await supabase.from("lockers").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="panel fade-up">
        <CardContent className="flex h-32 items-center justify-center">
          <div className="animate-pulse">Loading locker data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !locker) {
    return (
      <Card className="panel border-dashed fade-up">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted/20 p-4 mb-4">
            <Box className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Locker data not available</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Waiting for IoT synchronization. The "lockers" table with fields (locker_state,
            battery_percentage, battery_status, is_charging, iot_connection_status, last_updated) is
            required.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="panel max-w-md mx-auto fade-up">
      <CardHeader>
        <CardTitle>Locker Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Locker State</span>
          <Badge variant="outline">{locker.locker_state || "Unknown"}</Badge>
        </div>
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Backup Battery</span>
          <span className="font-semibold">
            {locker.battery_percentage != null ? `${locker.battery_percentage}%` : "N/A"}
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Battery Status</span>
          <span>{locker.battery_status || "Unknown"}</span>
        </div>
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Charging</span>
          <span>{locker.is_charging ? "Yes" : "No"}</span>
        </div>
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">IoT Status</span>
          <Badge variant={locker.iot_connection_status === "Connected" ? "default" : "secondary"}>
            {locker.iot_connection_status || "Unknown"}
          </Badge>
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
          <span>Last Updated</span>
          <span>{locker.last_updated ? format(new Date(locker.last_updated), "PPpp") : "N/A"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function KeyStatusSection() {
  const {
    data: keyData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["admin_keys"],
    queryFn: async () => {
      if (!supabase) throw new Error("No supabase");
      const { data, error } = await supabase.from("keys").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card className="panel fade-up">
        <CardContent className="flex h-32 items-center justify-center">
          <div className="animate-pulse">Loading key data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !keyData) {
    return (
      <Card className="panel border-dashed fade-up">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted/20 p-4 mb-4">
            <Key className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Key status not available</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Key tracking data has not been added or integrated with the backend yet. The "keys"
            table with fields (key_id, status, assigned_locker, current_booking, last_updated) is
            required.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="panel max-w-md mx-auto fade-up">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>Key Status</CardTitle>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={async () => {
              try {
                await refetch();
              } catch (e) {
                toast.error("Failed to refresh key status");
              }
            }}
            disabled={isRefetching}
            title="Refresh Key Status"
            aria-label="Refresh Key Status"
          >
            <RefreshCw className={cn("size-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Key Status</span>
          <Badge variant="outline">{keyData.status || "Unknown"}</Badge>
        </div>
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Key ID</span>
          <span className="font-semibold">{keyData.key_id || "N/A"}</span>
        </div>
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Assigned Locker</span>
          <span>{keyData.assigned_locker || "N/A"}</span>
        </div>
        <div className="flex justify-between items-center border-b border-border/10 pb-2">
          <span className="text-sm text-muted-foreground">Current Booking</span>
          <span>{keyData.current_booking || "None"}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
          <span>Last Updated</span>
          <span>
            {keyData.last_updated ? format(new Date(keyData.last_updated), "PPpp") : "N/A"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export { LogsSection } from "./LogsSection";

export { DailyBookingsSection } from "./DailyBookingsSection";
