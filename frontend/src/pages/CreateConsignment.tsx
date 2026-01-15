// src/pages/CreateConsignment.tsx
import React, { useState } from "react";
import api from "@/lib/api"; // your axios wrapper that attaches Authorization and baseURL
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CreateConsignment: React.FC = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [condition, setCondition] = useState("");
  const [provenance, setProvenance] = useState("");
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("FirstName", firstName);
      fd.append("LastName", lastName);
      fd.append("Email", email);
      if (phone) fd.append("Phone", phone);
      fd.append("Category", category);
      fd.append("ItemTitle", itemTitle);
      if (artist) fd.append("Artist", artist);
      if (year) fd.append("Year", year);
      if (dimensions) fd.append("Dimensions", dimensions);
      if (condition) fd.append("Condition", condition);
      if (provenance) fd.append("Provenance", provenance);
      if (description) fd.append("Description", description);
      if (estimate) fd.append("Estimate", estimate);
      if (files && files.length > 0) {
        Array.from(files).forEach((f) => fd.append("Images", f));
      }

      const res = await api.post("/consignments", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // server returns { Id = ... } in CreatedAtAction result; backend returns new { cons.Id }
      const createdId = res.data?.id ?? res.data?.Id ?? res.data?.id;
      setSuccessId(createdId ?? null);

      // redirect to a thank-you page, or to auctions page or consignment details
      if (createdId) navigate(`/consignments/${createdId}`);
      else navigate("/"); // fallback
    } catch (err: any) {
      console.error("submit failed", err);
      setError(err?.response?.data || err.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-3xl mx-auto">
        <CardContent>
          <h2 className="text-2xl font-bold mb-4">Submit Item for Consignment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>First name</Label>
                <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <Input required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Fine Art, Jewelry, Furniture..." />
            </div>

            <div>
              <Label>Item title / short description</Label>
              <Input required value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Artist / maker</Label>
                <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
              </div>
              <div>
                <Label>Year / period</Label>
                <Input value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div>
                <Label>Dimensions</Label>
                <Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Condition</Label>
              <Input value={condition} onChange={(e) => setCondition(e.target.value)} />
            </div>

            <div>
              <Label>Provenance / history</Label>
              <Textarea value={provenance} onChange={(e) => setProvenance(e.target.value)} rows={3} />
            </div>

            <div>
              <Label>Additional details</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>

            <div>
              <Label>Estimated value (optional)</Label>
              <Input value={estimate} onChange={(e) => setEstimate(e.target.value)} />
            </div>

            <div>
              <Label>Images (optional)</Label>
              <Input type="file" multiple accept="image/*" onChange={(e) => setFiles(e.target.files)} />
              <p className="text-sm text-muted-foreground mt-1">High-resolution images recommended; upload multiple angles.</p>
            </div>

            {error && <div className="text-red-600">{String(error)}</div>}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit for Evaluation"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/sell")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateConsignment;
