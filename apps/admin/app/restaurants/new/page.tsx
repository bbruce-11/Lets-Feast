"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import { ArrowLeft, Plus, Trash2, Loader2, Store } from "lucide-react";

interface MenuItemDraft {
  category: string;
  name: string;
  description: string;
  price: string;
}

function emptyMenuItem(): MenuItemDraft {
  return { category: "", name: "", description: "", price: "" };
}

export default function NewRestaurantPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [commissionRatePercent, setCommissionRatePercent] = useState("15");
  const [menuItems, setMenuItems] = useState<MenuItemDraft[]>([emptyMenuItem()]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMenuItem(index: number, patch: Partial<MenuItemDraft>) {
    setMenuItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addMenuItemRow() {
    setMenuItems((items) => [...items, emptyMenuItem()]);
  }

  function removeMenuItemRow(index: number) {
    setMenuItems((items) => items.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rate = Number(commissionRatePercent);
    if (!name.trim() || !cuisine.trim() || !neighborhood.trim()) {
      setError("Name, cuisine, and neighborhood are all required.");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setError("Commission rate must be a number between 0 and 100.");
      return;
    }

    const validItems = menuItems.filter((item) => item.name.trim() && item.category.trim());
    for (const item of validItems) {
      const price = Number(item.price);
      if (!Number.isFinite(price) || price < 0) {
        setError(`"${item.name}" needs a valid price.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await adminApi.createRestaurant({
        name: name.trim(),
        cuisine: cuisine.trim(),
        neighborhood: neighborhood.trim(),
        commissionRatePercent: rate,
        menuItems: validItems.map((item) => ({
          category: item.category.trim(),
          name: item.name.trim(),
          description: item.description.trim(),
          price: Number(item.price),
        })),
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create restaurant");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center gap-4 shadow-sm">
        <button
          onClick={() => router.push("/")}
          className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
          aria-label="Back to restaurants"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="bg-primary text-primary-foreground p-2 rounded-md">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-tight">Add Restaurant</h1>
          <p className="text-xs text-muted-foreground">Team-entered for pilot onboarding</p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Restaurant details
            </h2>
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Mission Taqueria"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cuisine">
                <input
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="input"
                  placeholder="Mexican"
                />
              </Field>
              <Field label="Neighborhood">
                <input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="input"
                  placeholder="Mission District"
                />
              </Field>
            </div>
            <Field
              label="Platform commission rate"
              hint="The percentage of each order's subtotal FEAST keeps. Restaurant receives the rest."
            >
              <div className="relative w-32">
                <input
                  value={commissionRatePercent}
                  onChange={(e) => setCommissionRatePercent(e.target.value)}
                  className="input pr-8"
                  inputMode="decimal"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  %
                </span>
              </div>
            </Field>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Menu items
              </h2>
              <span className="text-xs text-muted-foreground">Optional — can add later</span>
            </div>

            <div className="flex flex-col gap-3">
              {menuItems.map((item, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={item.category}
                      onChange={(e) => updateMenuItem(i, { category: e.target.value })}
                      className="input"
                      placeholder="Category (e.g. Tacos)"
                    />
                    <input
                      value={item.name}
                      onChange={(e) => updateMenuItem(i, { name: e.target.value })}
                      className="input"
                      placeholder="Item name"
                    />
                  </div>
                  <input
                    value={item.description}
                    onChange={(e) => updateMenuItem(i, { description: e.target.value })}
                    className="input"
                    placeholder="Description (optional)"
                  />
                  <div className="flex items-center gap-3">
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <input
                        value={item.price}
                        onChange={(e) => updateMenuItem(i, { price: e.target.value })}
                        className="input pl-6"
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMenuItemRow(i)}
                      className="ml-auto h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMenuItemRow}
              className="self-start h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add another item
            </button>
          </section>

          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? "Creating..." : "Create restaurant"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="h-10 px-5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
