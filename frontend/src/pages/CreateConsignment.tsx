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
    setError("Consignments are unavailable in this portfolio demo. No payment, shipping or settlement.");
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-3xl mx-auto">
        <CardContent>
          <h2 className="text-2xl font-bold mb-4">Submit Item for Consignment</h2>
          <p className="text-sm text-muted-foreground mb-4" role="note">Consignments are unavailable in this portfolio demo.</p>
          <form aria-disabled="true" onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="submit" disabled>
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
