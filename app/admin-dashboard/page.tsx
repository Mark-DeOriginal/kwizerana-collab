"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
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
  Search,
  Store,
  Trophy
} from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import { friendlyError, readJson } from "@/lib/client-request";
import type { Permission } from "@/lib/roles";
import { RankingsTab } from "@/components/RankingsTab";

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
  isSuperAdmin: boolean;
};

type Stats = {
  totalUsers: number;
  totalAdmins: number;
  totalProfiles: number;
  pendingSubmissions: number;
  pendingVendorApps: number;
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
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalAdmins: 0, totalProfiles: 0, pendingSubmissions: 0, pendingVendorApps: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [serverDenied, setServerDenied] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "rankings" | "vendors">("users");

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const usersPageSize = 20;
  const [totalUsers, setTotalUsers] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const canManage = session?.user?.role === "admin" ||
    (session?.user?.permissions ?? []).includes("manage_admins");

  const canViewDashboard = canAccessAdminReview(session?.user?.role, session?.user?.permissions);

  const loadUsers = useCallback(async (showLoading = false, silent = false) => {
    if (showLoading) setIsLoading(true);
    if (!silent) setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(usersPage));
      params.set("limit", String(usersPageSize));
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.status === 403) {
        setServerDenied(true);
        return;
      }
      const payload = (await readJson<{
        users?: DashboardUser[];
        total?: number;
        error?: string;
        stats?: { totalUsers?: number; totalAdmins?: number; totalProfiles?: number; pendingSubmissions?: number; pendingVendorApps?: number };
      }>(res)) ?? {};
      if (!res.ok) throw new Error(payload.error ?? "Failed to load users.");
      setServerDenied(false);
      setUsers(payload.users ?? []);
      setTotalUsers(payload.total ?? (payload.users ?? []).length);
      setStats({
        totalUsers: payload.stats?.totalUsers ?? payload.total ?? 0,
        totalAdmins: payload.stats?.totalAdmins ?? 0,
        totalProfiles: payload.stats?.totalProfiles ?? 0,
        pendingSubmissions: payload.stats?.pendingSubmissions ?? 0,
        pendingVendorApps: payload.stats?.pendingVendorApps ?? 0
      });
    } catch (err: unknown) {
      if (!silent) setError(friendlyError(err, "Something went wrong."));
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [debouncedSearch, usersPage]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (status === "authenticated") {
      loadUsers(true);
    }
  }, [status, loadUsers]);

  useEffect(() => {
    if (status === "authenticated" && !canAccessAdminReview(session?.user?.role, session?.user?.permissions)) {
      router.replace("/");
    }
  }, [status, session, router]);

  const usersTotalPages = Math.max(1, Math.ceil(totalUsers / usersPageSize));
  const safeUsersPage = Math.min(usersPage, usersTotalPages);
  const usersStart = (safeUsersPage - 1) * usersPageSize;
  const pageUsers = users;

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
      loadUsers(false, true);
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

  if (!canViewDashboard || serverDenied) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <ShieldCheck className="h-10 w-10 text-muted" />
        <p className="text-muted">You don&apos;t have access to this page.</p>
        {serverDenied && (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-2 flex h-9 items-center gap-2 border border-line bg-white px-4 text-sm font-semibold text-muted transition-colors hover:border-ocean hover:text-ink active:scale-[0.97]"
          >
            Sign out and sign back in
          </button>
        )}
      </div>
    );
  }

  function startPromote(userId: string, currentPermissions: Permission[]) {
    setPromotingId(userId);
    setSelectedPermissions([...currentPermissions]);
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
      const payload = (await readJson<{ error?: string }>(res)) ?? {};
      if (!res.ok) throw new Error(payload.error ?? "Failed to promote user.");
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, role: "admin" as const, permissions: selectedPermissions } : u
      ));
      setPromotingId(null);
      setSelectedPermissions([]);
      if (wasMember) {
        setStats((prev) => ({ ...prev, totalAdmins: prev.totalAdmins + 1 }));
        if (userId === session?.user?.id) {
          await update();
        } else {
          setSuccessMessage("User promoted. They need to sign out and sign back in for the changes to take effect.");
          setTimeout(() => setSuccessMessage(""), 8000);
        }
      }
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
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
      const payload = (await readJson<{ error?: string }>(res)) ?? {};
      if (!res.ok) throw new Error(payload.error ?? "Failed to demote user.");
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, role: "member" as const, permissions: [] } : u
      ));
      setStats((prev) => ({ ...prev, totalAdmins: Math.max(0, prev.totalAdmins - 1) }));
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
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

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
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
        <div className="border border-line bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Store className="h-3.5 w-3.5" />
            Pending vendor apps
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.pendingVendorApps}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 border border-moss/30 bg-moss/5 px-4 py-3 text-sm text-moss">
          {successMessage}
        </div>
      )}

      <div className="mb-6 flex border-b border-line">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors ${
            activeTab === "users"
              ? "border-ocean text-ink"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <User className="h-4 w-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab("vendors")}
          className={`flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors ${
            activeTab === "vendors"
              ? "border-ocean text-ink"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Store className="h-4 w-4" />
          Vendor Applications
        </button>
        <button
          onClick={() => setActiveTab("rankings")}
          className={`flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors ${
            activeTab === "rankings"
              ? "border-ocean text-ink"
              : "border-transparent text-muted hover:border-line hover:text-ink"
          }`}
        >
          <Trophy className="h-4 w-4" />
          Rankings
        </button>
      </div>

      {activeTab === "rankings" ? (
        <RankingsTab />
      ) : activeTab === "vendors" ? (
        <VendorApplicationsTab />
      ) : (
        <>
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
            onClick={() => loadUsers(true)}
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
          {pageUsers.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted">
              {totalUsers === 0 ? "No users found." : "No users match your search."}
            </div>
          ) : (
            <>
              <div className="mb-3 text-xs text-muted">
                Showing {totalUsers > 0 ? usersStart + 1 : 0}–{Math.min(usersStart + usersPageSize, totalUsers)} of {totalUsers}
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
                          {canManage && !isYou && !user.isSuperAdmin && (
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
              {totalUsers > usersPageSize && (
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
        </>
      )}
    </div>
  );
}

type VendorApplication = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  userImage: string | null;
  applicationType: string;
  requestedLevel: string;
  status: string;
  details: {
    cryptoCurrencies?: string[];
    fiatCurrencies?: string[];
    paymentMethodIds?: string[];
    bio?: string;
  };
  reviewedAt: string | null;
  createdAt: string;
};

function VendorApplicationsTab() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/vendor-applications?status=${status}`);
      const data = await readJson<{ applications?: VendorApplication[]; error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load applications.");
      setApplications(data?.applications ?? []);
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function reviewApplication(appId: string, action: "approve" | "reject") {
    setActionId(appId);
    setError("");
    try {
      const res = await fetch(`/api/admin/vendor-applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data?.error ?? "Action failed.");
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch (err: unknown) {
      setError(friendlyError(err, "Something went wrong."));
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">Vendor Applications</h2>
        <div className="flex gap-1.5">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`h-8 px-3 text-xs font-bold capitalize transition-colors ${
                filter === s ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : applications.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted">
          No {filter} applications.
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{app.userName ?? app.userEmail}</p>
                    <span className="text-xs text-muted">{app.userEmail}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">Applied {relativeTime(app.createdAt)}</p>
                  {app.details.cryptoCurrencies && (
                    <p className="mt-1.5 text-xs text-muted">
                      Wants to trade: <span className="font-semibold text-ink">{app.details.cryptoCurrencies.join(", ")}</span>
                      {" "}in <span className="font-semibold text-ink">{app.details.fiatCurrencies?.join(", ") ?? "—"}</span>
                    </p>
                  )}
                  {app.details.bio && (
                    <p className="mt-1 text-xs text-muted">&quot;{app.details.bio}&quot;</p>
                  )}
                </div>
                {filter === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => void reviewApplication(app.id, "approve")}
                      disabled={actionId === app.id}
                      className="flex h-8 items-center gap-1 bg-moss px-3 text-xs font-bold text-white transition-colors hover:bg-moss/90 disabled:opacity-60"
                    >
                      {actionId === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => void reviewApplication(app.id, "reject")}
                      disabled={actionId === app.id}
                      className="flex h-8 items-center gap-1 border border-coral/30 bg-white px-3 text-xs font-bold text-coral transition-colors hover:bg-coral/5 disabled:opacity-60"
                    >
                      <X className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                )}
                {filter !== "pending" && (
                  <span className={`shrink-0 text-xs font-bold uppercase ${filter === "approved" ? "text-moss" : "text-coral"}`}>
                    {app.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
