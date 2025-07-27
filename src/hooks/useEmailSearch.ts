import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Email {
  id: number;
  customer_id: number | null;
  subject: string;
  body: string;
  direction: string;
  attachments: any;
  created_at: string;
  received_at?: string;
  from_address?: string;
  to_address?: string;
  brand?: string;
  processed?: boolean;
}

interface SearchParams {
  searchTerm: string;
  brandFilter: string;
  statusFilter: string;
  offset: number;
  limit: number;
}

export const useEmailSearch = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    searchTerm: '',
    brandFilter: 'all',
    statusFilter: 'all',
    offset: 0,
    limit: 100
  });
  
  const { toast } = useToast();

  const buildQuery = useCallback((params: SearchParams, isCountQuery = false) => {
    let query = supabase.from('email_history').select('*', isCountQuery ? { count: 'exact', head: true } : undefined);

    // Search in subject, body, from_address, and to_address
    if (params.searchTerm.trim()) {
      const searchTerm = params.searchTerm.trim();
      query = query.or(`subject.ilike.%${searchTerm}%,body.ilike.%${searchTerm}%,from_address.ilike.%${searchTerm}%,to_address.ilike.%${searchTerm}%`);
    }

    // Filter by brand
    if (params.brandFilter !== 'all') {
      query = query.eq('brand', params.brandFilter);
    }

    // Filter by status
    if (params.statusFilter === 'processed') {
      query = query.eq('processed', true);
    } else if (params.statusFilter === 'unprocessed') {
      query = query.eq('processed', false);
    }

    if (!isCountQuery) {
      query = query
        .order('received_at', { ascending: false })
        .range(params.offset, params.offset + params.limit - 1);
    }

    return query;
  }, []);

  const searchEmails = useCallback(async (params: SearchParams, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
        setEmails([]);
      } else {
        setLoadingMore(true);
      }

      // Get total count
      const countQuery = buildQuery(params, true);
      const { count, error: countError } = await countQuery;
      
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get emails
      const emailQuery = buildQuery(params);
      const { data, error } = await emailQuery;

      if (error) throw error;

      const newEmails = data || [];
      
      if (isLoadMore) {
        setEmails(prev => [...prev, ...newEmails]);
      } else {
        setEmails(newEmails);
      }

      setHasMore(newEmails.length === params.limit);

    } catch (error: any) {
      console.error('Error searching emails:', error);
      toast({
        title: "Error",
        description: "Failed to search emails",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery, toast]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newParams = { ...searchParams, offset: 0 };
      setSearchParams(newParams);
      searchEmails(newParams);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchParams.searchTerm, searchParams.brandFilter, searchParams.statusFilter]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const newParams = {
        ...searchParams,
        offset: emails.length
      };
      searchEmails(newParams, true);
    }
  }, [emails.length, hasMore, loadingMore, searchParams, searchEmails]);

  const refresh = useCallback(() => {
    const newParams = { ...searchParams, offset: 0 };
    setSearchParams(newParams);
    searchEmails(newParams);
  }, [searchParams, searchEmails]);

  const updateSearchTerm = useCallback((term: string) => {
    setSearchParams(prev => ({ ...prev, searchTerm: term }));
  }, []);

  const updateBrandFilter = useCallback((brand: string) => {
    setSearchParams(prev => ({ ...prev, brandFilter: brand }));
  }, []);

  const updateStatusFilter = useCallback((status: string) => {
    setSearchParams(prev => ({ ...prev, statusFilter: status }));
  }, []);

  return {
    emails,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    searchParams,
    loadMore,
    refresh,
    updateSearchTerm,
    updateBrandFilter,
    updateStatusFilter
  };
};