"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api"; // axios wrapper
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isBlocked: boolean;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null); // track per-user action
  const [error, setError] = useState<string | null>(null);

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
      setError("Failed to fetch users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Block / Unblock user
  const toggleBlock = async (id: number, isBlocked: boolean) => {
    setActionLoading(id);
    try {
      await api.patch(`/admin/users/${id}/block`, { isBlocked: !isBlocked });
      await fetchUsers();
    } catch (err) {
      console.error("Block/Unblock failed", err);
      alert("Failed to update block status.");
    } finally {
      setActionLoading(null);
    }
  };

  // Delete user
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setActionLoading(id);
    try {
      await api.delete(`/admin/users/${id}`);
      await fetchUsers();
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete user.");
    } finally {
      setActionLoading(null);
    }
  };

  // Promote / Demote user role
  const toggleRole = async (id: number, role: "USER" | "ADMIN") => {
    setActionLoading(id);
    try {
      const newRole = role === "USER" ? "ADMIN" : "USER";
      await api.patch(`/admin/users/${id}/role`, { role: newRole });
      await fetchUsers();
    } catch (err) {
      console.error("Role update failed", err);
      alert("Failed to update role.");
    } finally {
      setActionLoading(null);
    }
  };

  // Add user / admin
  const addUser = async (role: "USER" | "ADMIN") => {
  const firstName = prompt("Enter first name:");
  if (!firstName) return;
  const lastName = prompt("Enter last name:");
  if (!lastName) return;
  const email = prompt("Enter email:");
  if (!email) return;
  const password = prompt("Enter password:");
  if (!password) return;

  try {
    const payload = {
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      role // <-- extra field so admin can assign role
    };
    await api.post("/auth/register", payload);
    fetchUsers();
  } catch (err) {
    console.error("Add user failed", err);
    alert("Failed to create user.");
  }
};


  return (
    <Card className="p-4">
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">User Management</h2>
          <div className="space-x-2">
            <Button onClick={() => addUser("USER")}>Add User</Button>
            <Button onClick={() => addUser("ADMIN")}>Add Admin</Button>
            <Button variant="secondary" onClick={fetchUsers}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading users...</span>
          </div>
        ) : error ? (
          <div className="text-red-500">
            {error}{" "}
            <Button size="sm" variant="outline" onClick={fetchUsers}>
              Retry
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div>No users found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "outline"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.isBlocked ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === u.id}
                      onClick={() => toggleBlock(u.id, u.isBlocked)}
                    >
                      {actionLoading === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : u.isBlocked ? (
                        "Unblock"
                      ) : (
                        "Block"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading === u.id}
                      onClick={() => toggleRole(u.id, u.role)}
                    >
                      {actionLoading === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : u.role === "USER" ? (
                        "Promote to Admin"
                      ) : (
                        "Demote to User"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionLoading === u.id}
                      onClick={() => handleDelete(u.id)}
                    >
                      {actionLoading === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Delete"
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
