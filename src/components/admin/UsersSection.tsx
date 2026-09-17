import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function UsersSection({ filterRole, title }: { filterRole?: string; title?: string } = {}) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    userId: string;
    userName: string;
    email: string;
  } | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{
    userId: string;
    newRole: string;
    userName: string;
    currentRole: string;
  } | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin_users", filterRole],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!supabase) throw new Error("No supabase");
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (filterRole) {
        query = query.eq("role", filterRole);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      if (user && userId === user.id) throw new Error("You cannot delete your own account.");
      const { error } = await supabase!.rpc("admin_delete_user", {
        target_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users_count"] });
      queryClient.invalidateQueries({ queryKey: ["admin_execom_count"] });
      setDeleteConfirm(null);
      toast.success("User successfully deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete user"),
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      if (user && userId === user.id) throw new Error("You cannot change your own role.");
      const { error, data } = await supabase!.rpc("admin_update_user_role", {
        target_user_id: userId,
        new_role: newRole,
      });
      if (error) throw error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users_count"] });
      queryClient.invalidateQueries({ queryKey: ["admin_execom_count"] });
      setRoleConfirm(null);
      toast.success("User role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredUsers =
    users?.filter(
      (u: any) =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  return (
    <>
      <Card className="panel fade-up">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title || "Member Management"}</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto bg-card/20 rounded-md border border-border/30">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="animate-pulse">
                    <TableCell colSpan={4} className="text-center h-24">
                      Loading members...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                      No members found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u: any) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.full_name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {u.id.split("-")[0]}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{u.email || "�"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {u.phone || "No phone"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(u.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {role === "admin" ? (
                            <Select
                              value={u.role}
                              onValueChange={(val) =>
                                updateRole.mutate({ userId: u.id, newRole: val })
                              }
                              disabled={isSelf || updateRole.isPending}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs font-semibold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="execom">ExeCom</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs uppercase font-bold tracking-wider px-2 py-1 bg-muted rounded-md text-muted-foreground border border-border/50">
                              {u.role}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!roleConfirm} onOpenChange={(open) => !open && setRoleConfirm(null)}>
        <DialogContent className="border-sidebar-border bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription className="pt-3">
              Are you sure you want to change this user's role?
              <div className="mt-4 p-3 bg-muted/50 rounded-md space-y-2 text-sm text-foreground">
                <p>
                  <span className="text-muted-foreground font-medium">User:</span>{" "}
                  {roleConfirm?.userName}
                </p>
                <p>
                  <span className="text-muted-foreground font-medium">Current role:</span>{" "}
                  <span className="uppercase font-bold text-muted-foreground">
                    {roleConfirm?.currentRole}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground font-medium">New role:</span>{" "}
                  <span className="uppercase font-bold text-primary">{roleConfirm?.newRole}</span>
                </p>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                This change will be saved permanently in Supabase until an authorized Admin changes
                it again.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setRoleConfirm(null)}
              disabled={updateRole.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (roleConfirm) {
                  updateRole.mutate({ userId: roleConfirm.userId, newRole: roleConfirm.newRole });
                }
              }}
              disabled={updateRole.isPending}
            >
              {updateRole.isPending ? "Updating..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="border-sidebar-border bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Member
            </DialogTitle>
            <DialogDescription className="pt-3">
              Are you sure you want to permanently delete this member?
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md space-y-2 text-sm text-foreground">
                <p>
                  <span className="text-muted-foreground font-medium">Name:</span>{" "}
                  {deleteConfirm?.userName}
                </p>
                <p>
                  <span className="text-muted-foreground font-medium">Email:</span>{" "}
                  {deleteConfirm?.email || "N/A"}
                </p>
                <p className="font-mono text-xs mt-2 pt-2 border-t border-destructive/10">
                  <span className="text-muted-foreground font-sans font-medium">Account ID:</span>{" "}
                  {deleteConfirm?.userId}
                </p>
                {deleteConfirm?.email.startsWith("test_") && (
                  <p className="font-mono text-xs text-warning bg-warning/10 p-1 rounded mt-1">
                    ⚠️ Flagged as Synthetic Test Data
                  </p>
                )}
              </div>
              <p className="mt-4 text-xs font-bold text-destructive">
                Warning: This action cannot be undone.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                If this user has genuine booking history, the database will safely block the
                deletion to preserve historical records. Test bookings attached to synthetic
                accounts should be cleaned up via SQL migration.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleteUser.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm) {
                  deleteUser.mutate(deleteConfirm.userId);
                }
              }}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
