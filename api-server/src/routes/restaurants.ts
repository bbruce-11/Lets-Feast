import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { restaurantsTable, menuItemsTable, ordersTable, usersTable } from "@workspace/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";

const router: IRouter = Router();

// Turns a reviewer's full name into a privacy-preserving display name shown
// publicly on the restaurant page: first name plus the last name's initial
// (e.g. "Jordan P."). Falls back to "Anonymous" when the name is missing.
function reviewerDisplayName(fullName: string | null): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "Anonymous";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

router.get("/restaurants", async (req, res) => {
  try {
    const rows = await db.select().from(restaurantsTable).orderBy(restaurantsTable.name);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list restaurants error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/restaurants/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, req.params.id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "get restaurant error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/restaurants/:id/menu", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.restaurantId, req.params.id))
      .orderBy(menuItemsTable.category, menuItemsTable.name);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "get menu error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public list of recent written diner reviews for a restaurant. Sourced from
// real rated orders — only those that carry a written comment are surfaced here
// (a bare star rating still counts toward the restaurant's average but is not a
// "review"). Returns the reviewer's privacy-safe display name, the star rating,
// the comment, and when it was left, newest first.
router.get("/restaurants/:id/reviews", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: ordersTable.id,
        rating: ordersTable.rating,
        comment: ordersTable.ratingComment,
        ratedAt: ordersTable.ratedAt,
        reviewerName: usersTable.fullName,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
      .where(
        and(
          eq(ordersTable.restaurantId, req.params.id),
          isNotNull(ordersTable.rating),
          isNotNull(ordersTable.ratingComment),
        ),
      )
      .orderBy(desc(ordersTable.ratedAt))
      .limit(50);

    res.json(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        ratedAt: r.ratedAt,
        reviewerName: reviewerDisplayName(r.reviewerName),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "get restaurant reviews error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
