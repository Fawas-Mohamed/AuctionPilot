import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type Category = { id: number; name: string };

const CreateAuction: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startPrice, setStartPrice] = useState<number | "">("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/categories");
        if (mounted) setCategories(res.data);
      } catch (e) {
        console.warn("Failed fetch categories", e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  //It uploads a file (image) to the backend and returns the uploaded image URL.
  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post("/uploads", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data?.imageUrl;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let imageUrl: string | undefined;
      if (file) {
        imageUrl = await uploadFile(file);
        if (!imageUrl) throw new Error("Upload failed: no imageUrl returned");
      }
      const payload = {
        title,
        description,
        imageUrl,
        startPrice: Number(startPrice),
        startTime,
        endTime,
        categoryId: categoryId ?? undefined
      };

      const res = await api.post("/auctions", payload);
      // redirect to auctions list (not detail) as you requested
      navigate(`/auctions`);
    } catch (err: any) {
      console.error("CreateAuction error", err);
      setError(err.response?.data?.message || err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center p-6">
      <Card className="w-full max-w-lg shadow-lg">
        <CardContent>
          <h2 className="text-xl font-bold mb-4">Create Auction</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} required />
            <Textarea placeholder="Description" value={description} onChange={(e)=>setDescription(e.target.value)} />
            <Input type="number" placeholder="Start Price" value={startPrice} onChange={(e)=>setStartPrice(e.target.value === "" ? "" : Number(e.target.value))} required />
            <Input type="datetime-local" value={startTime} onChange={(e)=>setStartTime(e.target.value)} required />
            <Input type="datetime-local" value={endTime} onChange={(e)=>setEndTime(e.target.value)} required />

            <label className="block">
              <span className="text-sm">Category</span>
              <select className="mt-1 block w-full" value={categoryId ?? ""} onChange={(e)=>setCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">-- Select category --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
            {error && <p className="text-red-500">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Auction"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateAuction;
