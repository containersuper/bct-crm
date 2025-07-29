import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Brand detection patterns
const BRAND_PATTERNS = {
  ACM: {
    emailDomains: ['acm-container.de'],
    companyPatterns: ['acm', 'seecontainer', 'HO ACM B.V.', 'HO ACM BV'],
  },
  BCT: {
    emailDomains: ['bct-containers.com'],
    companyPatterns: ['bct', 'belgium container trading', 'BCT -'],
  },
  HR: {
    emailDomains: ['hr-containerhandel.de'],
    companyPatterns: ['hr containerhandel', 'hr-containerhandel'],
  },
  Contiflex: {
    emailDomains: ['contiflex.de'],
    companyPatterns: ['contiflex', 'conti'],
  },
};

// Regional patterns
const POSTAL_CODE_PATTERNS = {
  DE: /D-(\d{5})/g,
  LU: /LU-(\d{4})/g,
  AT: /A-(\d{4})/g,
  NL: /NL-(\d{4})/g,
  BE: /B-(\d{4})/g,
};

export interface TeamLeaderAnalytics {
  brands: {
    [key: string]: {
      customers: number;
      deals: number;
      totalValue: number;
      quotes: number;
      invoices: number;
    };
  };
  regions: {
    [key: string]: {
      deals: number;
      totalValue: number;
      customers: number;
    };
  };
  totals: {
    customers: number;
    deals: number;
    quotes: number;
    invoices: number;
    totalRevenue: number;
  };
  monthlyTrends: Array<{
    month: string;
    [brandKey: string]: number | string;
  }>;
  containerTypes: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

function detectBrand(company: string = '', email: string = '', dealTitle: string = '', invoiceNumber: string = '', quoteNumber: string = ''): string {
  const companyLower = company.toLowerCase();
  const emailLower = email.toLowerCase();
  const titleLower = dealTitle.toLowerCase();
  
  // NEW: Check for container grade patterns in deal titles (ACM uses different grades)
  if (titleLower.includes('20 ft. a') || titleLower.includes('20ft a') || titleLower.includes("20' a")) {
    return 'ACM Grade A';
  }
  if (titleLower.includes('20 ft. b') || titleLower.includes('20ft b') || titleLower.includes("20' b")) {
    return 'ACM Grade B';
  }
  if (titleLower.includes('20 ft. c') || titleLower.includes('20ft c') || titleLower.includes("20' c")) {
    return 'ACM Grade C';
  }
  
  // Check for different invoice/quote number patterns
  if (invoiceNumber) {
    // Different year formats might indicate different brands
    if (invoiceNumber.includes('2022 /')) {
      return 'ACM Container';
    }
    if (invoiceNumber.includes('HR-') || invoiceNumber.includes('HR/')) {
      return 'HR Containerhandel';
    }
    if (invoiceNumber.includes('BCT-') || invoiceNumber.includes('BCT/')) {
      return 'BCT';
    }
  }
  
  // Check for specific container types that might indicate different brands
  if (titleLower.includes('10 ft') || titleLower.includes("10'")) {
    return 'ACM Specialty';
  }
  if (titleLower.includes('40 ft') || titleLower.includes("40'")) {
    return 'ACM Large';
  }
  
  // Check email domains (original logic)
  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    if (patterns.emailDomains.some(domain => emailLower.includes(domain))) {
      return brand;
    }
  }

  // Check company name patterns (original logic)
  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    if (patterns.companyPatterns.some(pattern => 
      companyLower.includes(pattern.toLowerCase())
    )) {
      return brand;
    }
  }

  // Default brand based on container pattern
  if (titleLower.includes('angebot') || titleLower.includes('anfrage')) {
    return 'ACM Container';
  }

  return 'ACM Container'; // Default to ACM since all data comes from one company
}

function extractRegion(title: string = ''): string | null {
  for (const [country, pattern] of Object.entries(POSTAL_CODE_PATTERNS)) {
    const matches = title.match(pattern);
    if (matches && matches.length > 0) {
      return country;
    }
  }
  return null;
}

function extractContainerType(title: string = ''): string | null {
  const containerPatterns = [
    { pattern: /20\s*ft|20'|20-foot/i, type: '20ft Standard' },
    { pattern: /40\s*ft\s*hc|40'\s*hc|40-foot\s*hc|high\s*cube/i, type: '40ft High Cube' },
    { pattern: /40\s*ft|40'|40-foot/i, type: '40ft Standard' },
    { pattern: /8\s*ft|8'|8-foot/i, type: '8ft Container' },
    { pattern: /refrigerat|reefer|cool/i, type: 'Refrigerated' },
  ];

  for (const { pattern, type } of containerPatterns) {
    if (pattern.test(title)) {
      return type;
    }
  }
  
  return null;
}

export function useTeamLeaderData() {
  const [data, setData] = useState<TeamLeaderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        customersResponse,
        dealsResponse,
        quotesResponse,
        invoicesResponse,
        emailHistoryResponse,
      ] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('teamleader_deals').select('*'),
        supabase.from('teamleader_quotes').select('*'),
        supabase.from('teamleader_invoices').select('*'),
        supabase.from('email_history').select('from_address, brand'),
      ]);

      if (customersResponse.error) throw customersResponse.error;
      if (dealsResponse.error) throw dealsResponse.error;
      if (quotesResponse.error) throw quotesResponse.error;
      if (invoicesResponse.error) throw invoicesResponse.error;

      const customers = customersResponse.data || [];
      const deals = dealsResponse.data || [];
      const quotes = quotesResponse.data || [];
      const invoices = invoicesResponse.data || [];
      const emailHistory = emailHistoryResponse.data || [];

      // Create email to brand mapping from email history
      const emailBrandMapping: { [email: string]: string } = {};
      emailHistory.forEach(email => {
        if (email.from_address && email.brand) {
          emailBrandMapping[email.from_address.toLowerCase()] = email.brand;
        }
      });

      // Analyze brands
      const brandAnalysis: { [key: string]: any } = {};
      const regionAnalysis: { [key: string]: any } = {};
      const containerTypes: { [key: string]: number } = {};

      // Initialize brand categories - updated with new categories
      const brandCategories = [
        'ACM Grade A', 'ACM Grade B', 'ACM Grade C', 
        'ACM Container', 'ACM Specialty', 'ACM Large',
        'BCT', 'HR', 'Contiflex', 'Other'
      ];
      
      brandCategories.forEach(brand => {
        brandAnalysis[brand] = {
          customers: 0,
          deals: 0,
          totalValue: 0,
          quotes: 0,
          invoices: 0,
        };
      });

      // Analyze customers and detect brands
      customers.forEach(customer => {
        const brand = detectBrand(customer.company || customer.name || '', customer.email || '');
        brandAnalysis[brand].customers++;
      });

      // Analyze deals
      deals.forEach(deal => {
        const customerBrand = customers.find(c => c.id === deal.customer_id);
        // Use deal title and other info for better brand detection
        const brand = detectBrand(
          customerBrand?.company || customerBrand?.name || '', 
          customerBrand?.email || '', 
          deal.title || deal.description || '',
          '', // no invoice number for deals
          ''  // no quote number for deals
        );
        
        brandAnalysis[brand].deals++;
        brandAnalysis[brand].totalValue += Number(deal.value || 0);

        // Extract region
        const region = extractRegion(deal.title || deal.description || '');
        if (region) {
          if (!regionAnalysis[region]) {
            regionAnalysis[region] = { deals: 0, totalValue: 0, customers: 0 };
          }
          regionAnalysis[region].deals++;
          regionAnalysis[region].totalValue += Number(deal.value || 0);
        }

        // Extract container type
        const containerType = extractContainerType(deal.title || deal.description || '');
        if (containerType) {
          containerTypes[containerType] = (containerTypes[containerType] || 0) + 1;
        }
      });

      // Analyze quotes
      quotes.forEach(quote => {
        const customerBrand = customers.find(c => c.id === quote.customer_id);
        const brand = detectBrand(
          customerBrand?.company || customerBrand?.name || '', 
          customerBrand?.email || '', 
          quote.title || quote.description || '',
          '', // no invoice number for quotes
          quote.quote_number || ''
        );
        
        brandAnalysis[brand].quotes++;
      });

      // Analyze invoices
      invoices.forEach(invoice => {
        const customerBrand = customers.find(c => c.id === invoice.customer_id);
        const brand = detectBrand(
          customerBrand?.company || customerBrand?.name || '', 
          customerBrand?.email || '', 
          invoice.title || invoice.description || '',
          invoice.invoice_number || '',
          '' // no quote number for invoices
        );
        
        brandAnalysis[brand].invoices++;
      });

      // Calculate totals
      const totals = {
        customers: customers.length,
        deals: deals.length,
        quotes: quotes.length,
        invoices: invoices.length,
        totalRevenue: deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
      };

      // Generate monthly trends (simplified for now)
      const monthlyTrends = [
        { month: 'Jan', ACM: 0, BCT: 0, HR: 0, Contiflex: 0, Other: 0 },
        { month: 'Feb', ACM: 0, BCT: 0, HR: 0, Contiflex: 0, Other: 0 },
        { month: 'Mar', ACM: 0, BCT: 0, HR: 0, Contiflex: 0, Other: 0 },
        { month: 'Apr', ACM: 0, BCT: 0, HR: 0, Contiflex: 0, Other: 0 },
        { month: 'May', ACM: 0, BCT: 0, HR: 0, Contiflex: 0, Other: 0 },
        { month: 'Jun', ACM: 0, BCT: 0, HR: 0, Contiflex: 0, Other: 0 },
      ];

      // Convert container types to array with percentages
      const totalContainers = Object.values(containerTypes).reduce((sum, count) => sum + count, 0);
      const containerTypesArray = Object.entries(containerTypes).map(([name, count]) => ({
        name,
        count,
        percentage: totalContainers > 0 ? Math.round((count / totalContainers) * 100) : 0,
      }));

      setData({
        brands: brandAnalysis,
        regions: regionAnalysis,
        totals,
        monthlyTrends,
        containerTypes: containerTypesArray,
      });

    } catch (err) {
      console.error('Error fetching TeamLeader data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up real-time subscriptions for auto-updates
    const subscriptions = [
      supabase
        .channel('teamleader-customers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchData)
        .subscribe(),
      
      supabase
        .channel('teamleader-deals')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teamleader_deals' }, fetchData)
        .subscribe(),
      
      supabase
        .channel('teamleader-quotes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teamleader_quotes' }, fetchData)
        .subscribe(),
      
      supabase
        .channel('teamleader-invoices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teamleader_invoices' }, fetchData)
        .subscribe(),
    ];

    return () => {
      subscriptions.forEach(sub => supabase.removeChannel(sub));
    };
  }, []);

  return { data, loading, error, refetch: fetchData };
}