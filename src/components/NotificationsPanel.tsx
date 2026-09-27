import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: "reminder" | "escalation" | "system";
  message: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user || !supabase) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
      }
      return data as Notification[];
    },
    enabled: !!user,
    refetchInterval: 60000, // Poll every minute
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", user?.id] });
      const previousNotifications = queryClient.getQueryData<Notification[]>(["notifications", user?.id]);
      
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], (old) => {
        if (!old) return old;
        return old.map(n => n.id === id ? { ...n, is_read: true } : n);
      });
      
      return { previousNotifications };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(["notifications", user?.id], context.previousNotifications);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 flex size-2 items-center justify-center rounded-full bg-destructive">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {unreadCount} unread
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "group flex flex-col gap-1 border-b p-4 text-sm transition-colors last:border-b-0 hover:bg-muted/50",
                    !n.is_read ? "bg-muted/30" : "opacity-70",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="flex-1 font-medium leading-tight">
                      {n.type === "escalation" && (
                        <span className="text-destructive font-bold mr-1">[URGENT]</span>
                      )}
                      {n.message}
                    </p>
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                        onClick={() => markAsRead.mutate(n.id)}
                        title="Mark as read"
                      >
                        <Check className="size-4" />
                      </Button>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
