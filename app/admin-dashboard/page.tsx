"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  User,
  Loader2,
  Crown,
  Clock,
  Check,
  X,
  Database,
  FileClock,
  Pencil,
  Search
} from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import type { Permission } from "@/lib/roles";

const ALL_PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "manage_admins", label: "Can manage admins", description: "Promote and demote other users" },
  { key: "remove_profiles", label: "Can remove profiles", description: "Delete profiles from the review page" },
  { key: "view_dashboard", label: "Can view dashboard", description: "Access this admin dashboard" }
];

type DashboardUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "admin" | "member";
  permissions: Permission[];
  created_at: string;
  last_sign_in_at: string;
};

type Stats = {
  totalUsers: number;
  totalAdmins: number;
  totalProfiles: number;
  pendingSubmissions: number;
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalAdmins: 0, totalProfiles: 0, pendingSubmissions: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const usersPageSize = 20;
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const canManage = session?.user?.role === "admin" ||
    (session?.user?.permissions ?? []).includes("manage_admins");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to load users.");
      setUsers(payload.users ?? []);
      setStats({
        totalUsers: (payload.users ?? []).length,
        totalAdmins: (payload.users ?? []).filter((u: DashboardUser) => u.role === "admin").length,
        totalProfiles: payload.stats?.totalProfiles ?? 0,
        pendingSubmissions: payload.stats?.pendingSubmissions ?? 0
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      loadUsers();
    }
  }, [status, loadUsers]);

  useEffect(() => {
    if (status === "authenticated" && !canAccessAdminReview(session?.user?.role)) {
      router.replace("/");
    }
  }, [status, session, router]);

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPageSize));
  const safeUsersPage = Math.min(usersPage, usersTotalPages);
  const usersStart = (safeUsersPage - 1) * usersPageSize;
  const pageUsers = filteredUsers.slice(usersStart, usersStart + usersPageSize);

  useEffect(() => {
    setUsersPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sendHeartbeat = () => fetch("/api/user/heartbeat", { method: "POST" }).catch(() => {});

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const interval = setInterval(() => {
      loadUsers();
    }, 120000);

    return () => clearInterval(interval);
  }, [status, loadUsers]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted">Sign in to access the admin dashboard.</p>
      </div>
    );
  }

  if (!canAccessAdminReview(session?.user?.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <ShieldCheck className="h-10 w-10 text-muted" />
        <p className="text-muted">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  function startPromote(userId: string, currentPermissions: Permission[]) {
    setPromotingId(userId);
    setSelectedPermissions(currentPermissions.length > 0 ? [...currentPermissions] : ["view_dashboard"]);
  }

  function cancelPromote() {
    setPromotingId(null);
    setSelectedPermissions([]);
  }

  function togglePermission(perm: Permission) {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  async function confirmPromote(userId: string) {
    setActionLoadingId(userId);
    try {
      const wasMember = users.find((u) => u.id === userId)?.role === "member";
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote", permissions: selectedPermissions })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to promote user.");
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, role: "admin" as const, permissions: selectedPermissions } : u
      ));
      setPromotingId(null);
      setSelectedPermissions([]);
      if (wasMember) setStats((prev) => ({ ...prev, totalAdmins: prev.totalAdmins + 1 }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function demoteUser(userId: string) {
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demote" })
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to demote user.");
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, role: "member" as const, permissions: [] } : u
      ));
      setStats((prev) => ({ ...prev, totalAdmins: Math.max(0, prev.totalAdmins - 1) }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-ocean" />
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="mt-1 text-sm text-muted">Manage users, roles, and permissions.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <User className="h-3.5 w-3.5" />
            Total users
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.totalUsers}</p>
        </div>
        <div className="border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Shield className="h-3.5 w-3.5" />
            Admins
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.totalAdmins}</p>
        </div>
        <div className="border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Database className="h-3.5 w-3.5" />
            Active profiles
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.totalProfiles}</p>
        </div>
        <div className="border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <FileClock className="h-3.5 w-3.5" />
            Pending submissions
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.pendingSubmissions}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold">Users</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="h-9 w-full border border-line bg-white pl-9 pr-3 text-xs outline-none transition-colors focus:border-ocean sm:w-64"
            />
          </div>
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="flex h-9 items-center gap-2 border border-line bg-white px-3 text-xs font-semibold text-muted transition-colors hover:border-ocean hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : (
        <>
          {filteredUsers.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted">
              {searchQuery ? "No users match your search." : "No users found."}
            </div>
          ) : (
            <>
              <div className="mb-3 text-xs text-muted">
                Showing {usersStart + 1}–{Math.min(usersStart + usersPageSize, filteredUsers.length)} of {filteredUsers.length}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pageUsers.map((user) => {
                  const isYou = user.email.toLowerCase() === session?.user?.email?.toLowerCase();
                  const isPromoting = promotingId === user.id;
                  const isLoadingAction = actionLoadingId === user.id;

                  return (
                    <div key={user.id} className="border border-line bg-white p-5">
                      <div className="flex items-start gap-4">
                        {user.image && !failedImages.has(user.id) ? (
                          <Image
                            src={user.image}
                            alt={user.name ?? user.email}
                            width={48}
                            height={48}
                            className="h-12 w-12 shrink-0 rounded-full object-cover"
                            onError={() => setFailedImages((prev) => new Set(prev).add(user.id))}
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-full bg-line" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold">{user.name ?? "Unnamed"}</h3>
                            {user.role === "admin" && (
                              <span className="shrink-0 rounded bg-ocean/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ocean">
                                Admin
                              </span>
                            )}
                            {isYou && (
                              <span className="shrink-0 rounded bg-moss/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-moss">
                                You
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                      </div>

                      {user.role === "admin" && user.permissions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {user.permissions.map((perm) => (
                            <span key={perm} className="rounded bg-panel px-1.5 py-0.5 text-[10px] font-medium text-muted">
                              {ALL_PERMISSIONS.find((p) => p.key === perm)?.label ?? perm}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
                        <span>Joined {relativeTime(user.created_at)}</span>
                        <span>Active {relativeTime(user.last_sign_in_at)}</span>
                      </div>

                      {isPromoting ? (
                        <div className="mt-4 border-t border-line pt-3">
                          <p className="mb-2 text-xs font-bold">Assign permissions:</p>
                          <div className="flex flex-col gap-2">
                            {ALL_PERMISSIONS.map((perm) => (
                              <label key={perm.key} className="flex cursor-pointer items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.key)}
                                  onChange={() => togglePermission(perm.key)}
                                  className="h-3.5 w-3.5 accent-ocean"
                                />
                                <span className="font-medium">{perm.label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => confirmPromote(user.id)}
                              disabled={isLoadingAction || selectedPermissions.length === 0}
                              className="flex h-8 items-center gap-1.5 bg-ocean px-3 text-xs font-bold text-white transition-colors hover:bg-ocean/90 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
                            >
                              {isLoadingAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Confirm
                            </button>
                            <button
                              onClick={cancelPromote}
                              disabled={isLoadingAction}
                              className="flex h-8 items-center gap-1.5 border border-line bg-white px-3 text-xs font-bold text-muted transition-colors hover:border-ocean hover:text-ink disabled:opacity-50 active:scale-[0.97]"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex gap-2 border-t border-line pt-3">
                          {canManage && !isYou && (
                            <>
                              {user.role === "member" ? (
                                <button
                                  onClick={() => startPromote(user.id, user.permissions)}
                                  disabled={isLoadingAction}
                                  className="flex h-8 items-center gap-1.5 bg-ocean px-3 text-xs font-bold text-white transition-colors hover:bg-ocean/90 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
                                >
                                  <Crown className="h-3 w-3" />
                                  Make admin
                                </button>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startPromote(user.id, user.permissions)}
                                    disabled={isLoadingAction}
                                    className="flex h-8 items-center gap-1.5 border border-line bg-white px-3 text-xs font-bold text-ink transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Edit permissions
                                  </button>
                                  <button
                                    onClick={() => demoteUser(user.id)}
                                    disabled={isLoadingAction}
                                    className="flex h-8 items-center gap-1.5 border border-coral/30 bg-white px-3 text-xs font-bold text-coral transition-colors hover:bg-coral/5 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
                                  >
                                    {isLoadingAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                                    Remove admin
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filteredUsers.length > usersPageSize && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setUsersPage(Math.max(1, safeUsersPage - 1))}
                    disabled={safeUsersPage <= 1}
                    className="h-9 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: usersTotalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
                    <button
                      key={page}
                      onClick={() => setUsersPage(page)}
                      className={`h-9 min-w-9 border px-3 text-sm font-semibold transition-colors ${
                        safeUsersPage === page ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ocean hover:text-ink"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setUsersPage(Math.min(usersTotalPages, safeUsersPage + 1))}
                    disabled={safeUsersPage >= usersTotalPages}
                    className="h-9 border border-line bg-white px-3 text-sm font-semibold transition-colors hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
