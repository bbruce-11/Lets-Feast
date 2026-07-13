import { useCallback, useEffect, useState } from 'react';
import { restaurantsApi, type ApiRestaurantReview } from '@/lib/api';

export function useReviews(id: string) {
  const [reviews, setReviews] = useState<ApiRestaurantReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!id) return Promise.resolve();
    setIsLoading(true);
    return restaurantsApi
      .reviews(id)
      .then((data) => setReviews(data))
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { reviews, isLoading, error, refresh };
}
