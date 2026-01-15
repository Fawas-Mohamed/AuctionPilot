import { useEffect, useState } from "react";
import api from "@/lib/api";

export type Category = {
  id: number;
  name: string;
  description?: string | null;
};

export default function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchCategories = async () => {
      try {
        const res = await api.get("/categories");
        if (mounted) setCategories(res.data || []);
      } catch (err: any) {
        console.error("Failed to load categories", err);
        if (mounted) setError(err?.message ?? "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchCategories();
    return () => { mounted = false; };
  }, []);

  return { categories, loading, error };
}
