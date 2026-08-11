"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import type { Restaurant, MenuItem } from "@/lib/api";
import { ArrowLeft, Plus, Trash2, Loader2, Store, UtensilsCrossed } from "lucide-react";

interface MenuItemDraft {
  category: string;
  name: string;
  description: string;
  price: string;
}

function emptyMenuItem(): MenuItemDraft {
  return { category: "", name: "", description: "", price: "" };
}

export default function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [existingItems, setExistingItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newItems, setNewItems] = useState<MenuItemDraft[]>([emptyMenuItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [r, items] = await Promise.all([
        adminApi.getRestaurant(id),
        adminApi.getMenu(id),
      ]);
      setRestaurant(r);
      setExistingItems(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load restaurant");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function updateItem(index: number, patch: Partial<MenuItemDraft>) {
    setNewItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItemRow() {
    setNewItems((items) => [...items, emptyMenuItem()]);
  }

  function removeItemRow(index: number) {
    setNewItems((items) => items.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const validItems = newItems.filter((item) => item.name.trim() && item.category.trim());
    if (validItems.length === 0) {
      setSubmitError("Add at least one item with a category and name.");
      return;
    }
    for (const item of validItems) {
      const price = Number(item.price);
      if (!Number.isFinite(price) || price < 0) {
        setSubmitError(`"${item.name}" needs a valid price.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await adminApi.addMenuItems(
        id,
        validItems.map((item) => ({
          category: item.category.trim(),
          name: item.name.trim(),
          description: item.description.trim(),
          price: Number(item.price),
        })),
      );
      setNewItems([emptyMenuItem()]);
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to add menu items");
    } finally {
      setIsSubmitting(false);
    }
  }

  const groupedExisting = existingItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

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
          <h1 className="font-bold text-lg leading-tight tracking-tight">
            {restaurant?.name ?? "Restaurant"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {restaurant ? [restaurant.cuisine, restaurant.neighborhood].filter(Boolean).join(" · ") : "Loading..."}
          </p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-3">Loading...</span>
          </div>
        ) : loadError ? (
          <div className="bg-destructive/10 text-destructive p-6 rounded-lg border border-destructive/20 text-center">
            <p className="font-bold mb-2">Error loading data</p>
            <p className="text-sm">{loadError}</p>
            <button
              onClick={load}
              className="mt-4 px-4 py-2 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Current menu
              </h2>
              {existingItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  No menu items yet — add some below.
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {Object.entries(groupedExisting).map(([category, items]) => (
                    <div key={category} className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {category}
                      </h3>
                      <div className="flex flex-col gap-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border bg-card px-4 py-3 flex items-start justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground">{item.name}</p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-mono text-foreground shrink-0">
                              ${Number(item.price).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Add menu items
              </h2>

              <div className="flex flex-col gap-3">
                {newItems.map((item, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={item.category}
                        onChange={(e) => updateItem(i, { category: e.target.value })}
                        className="input"
                        placeholder="Category (e.g. Tacos)"
                      />
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        className="input"
                        placeholder="Item name"
                      />
                    </div>
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
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
                          onChange={(e) => updateItem(i, { price: e.target.value })}
                          className="input pl-6"
                          placeholder="0.00"
                          inputMode="decimal"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemRow(i)}
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
                onClick={addItemRow}
                className="self-start h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add another item
              </button>

              {submitError && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20 text-sm">
                  {submitError}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-5 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? "Adding..." : "Add to menu"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
