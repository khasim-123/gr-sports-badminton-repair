/**
 * GR Sports Platform - Website Content Service
 * Public storefront content + admin management for banners, strings & stock,
 * reviews, documents, availability and media uploads.
 */
import { apiClient, ApiError, getAuthToken } from './apiClient';
import {
  AvailabilitySettings,
  Banner,
  BannerInput,
  CustomerReview,
  PublicAvailability,
  PublicReviewsResponse,
  PublicSiteContent,
  Racket,
  RacketInput,
  SiteEvent,
  SiteEventInput,
  ShopSettings,
  EventRegistration,
  EventRegistrationInput,
  ReviewModerationUpdate,
  ReviewStatus,
  ReviewSubmission,
  SiteDocument,
  SiteDocumentInput,
  StringProduct,
  StringProductInput,
  StringVariant,
  StringVariantInput,
  UploadedMedia,
} from '../types/content';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const contentService = {
  // ---------- Public ----------

  /** GET /api/content/site — banners, strings, approved reviews, public documents, availability */
  getPublicSite(): Promise<PublicSiteContent> {
    return apiClient.get<PublicSiteContent>('/content/site');
  },

  getPublicBanners(): Promise<Banner[]> {
    return apiClient.get<Banner[]>('/content/banners');
  },

  getPublicStrings(): Promise<StringProduct[]> {
    return apiClient.get<StringProduct[]>('/content/strings');
  },

  /** Upcoming and ongoing published events, soonest first. `includePast` adds recent past events. */
  getPublicEvents(includePast = false): Promise<SiteEvent[]> {
    return apiClient.get<SiteEvent[]>(`/content/events${includePast ? '?include_past=true' : ''}`);
  },

  /** Anyone may register for an event whose registrationMode is 'form'. */
  registerForEvent(eventId: string, input: EventRegistrationInput): Promise<EventRegistration> {
    return apiClient.post<EventRegistration>(`/content/events/${eventId}/register`, input);
  },

  /** Shop name, phone, WhatsApp, address, opening hours — public. */
  getShopSettings(): Promise<ShopSettings> {
    return apiClient.get<ShopSettings>('/config/shop');
  },
  /** Admin only. */
  updateShopSettings(input: ShopSettings): Promise<ShopSettings> {
    return apiClient.put<ShopSettings>('/config/shop', input);
  },

  getPublicRackets(): Promise<Racket[]> {
    return apiClient.get<Racket[]>('/content/rackets');
  },

  getPublicReviews(limit = 12): Promise<PublicReviewsResponse> {
    return apiClient.get<PublicReviewsResponse>(`/reviews?limit=${limit}`);
  },

  /** Anyone may submit; reviews start as `pending` until an admin approves them. */
  submitReview(review: ReviewSubmission): Promise<CustomerReview> {
    return apiClient.post<CustomerReview>('/reviews', review);
  },

  getPublicDocuments(): Promise<SiteDocument[]> {
    return apiClient.get<SiteDocument[]>('/documents');
  },

  getAvailability(days = 30): Promise<PublicAvailability> {
    return apiClient.get<PublicAvailability>(`/availability?days=${days}`);
  },

  // ---------- Admin: media ----------

  /** POST /api/media (multipart). Images are resized + converted to WebP server-side. */
  async uploadMedia(file: File): Promise<UploadedMedia> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(`File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`, 413);
    }
    const form = new FormData();
    form.append('file', file);
    const token = getAuthToken();
    const response = await fetch(`${apiClient.baseUrl}/media`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    if (!response.ok) {
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // ignore
      }
      throw new ApiError(data?.detail || data?.message || `Upload failed (${response.status})`, response.status, data);
    }
    return response.json();
  },

  // ---------- Admin: banners ----------

  listBanners(): Promise<Banner[]> {
    return apiClient.get<Banner[]>('/content/admin/banners');
  },
  createBanner(input: BannerInput): Promise<Banner> {
    return apiClient.post<Banner>('/content/admin/banners', input);
  },
  updateBanner(id: string, input: Partial<BannerInput>): Promise<Banner> {
    return apiClient.put<Banner>(`/content/admin/banners/${id}`, input);
  },
  deleteBanner(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/content/admin/banners/${id}`);
  },
  reorderBanners(ids: string[]): Promise<Banner[]> {
    return apiClient.post<Banner[]>('/content/admin/banners/reorder', { ids });
  },

  // ---------- Admin: strings & colour stock ----------

  listStrings(): Promise<StringProduct[]> {
    return apiClient.get<StringProduct[]>('/content/admin/strings');
  },
  createString(input: StringProductInput): Promise<StringProduct> {
    return apiClient.post<StringProduct>('/content/admin/strings', input);
  },
  updateString(id: string, input: Partial<StringProductInput>): Promise<StringProduct> {
    return apiClient.put<StringProduct>(`/content/admin/strings/${id}`, input);
  },
  deleteString(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/content/admin/strings/${id}`);
  },
  addVariant(productId: string, input: StringVariantInput): Promise<StringVariant> {
    return apiClient.post<StringVariant>(`/content/admin/strings/${productId}/variants`, input);
  },
  updateVariant(variantId: string, input: Partial<StringVariantInput>): Promise<StringVariant> {
    return apiClient.put<StringVariant>(`/content/admin/string-variants/${variantId}`, input);
  },
  deleteVariant(variantId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/content/admin/string-variants/${variantId}`);
  },
  /** Mark every colour of a product in / out of stock at once. */
  setAllVariantsStock(productId: string, inStock: boolean): Promise<StringProduct> {
    return apiClient.post<StringProduct>(`/content/admin/strings/${productId}/stock`, { inStock });
  },

  // ---------- Admin: rackets ----------

  listRackets(): Promise<Racket[]> {
    return apiClient.get<Racket[]>('/content/admin/rackets');
  },
  createRacket(input: RacketInput): Promise<Racket> {
    return apiClient.post<Racket>('/content/admin/rackets', input);
  },
  updateRacket(id: string, input: Partial<RacketInput>): Promise<Racket> {
    return apiClient.put<Racket>(`/content/admin/rackets/${id}`, input);
  },
  deleteRacket(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/content/admin/rackets/${id}`);
  },

  // ---------- Admin: events ----------

  listEvents(): Promise<SiteEvent[]> {
    return apiClient.get<SiteEvent[]>('/content/admin/events');
  },
  createEvent(input: SiteEventInput): Promise<SiteEvent> {
    return apiClient.post<SiteEvent>('/content/admin/events', input);
  },
  updateEvent(id: string, input: Partial<SiteEventInput>): Promise<SiteEvent> {
    return apiClient.put<SiteEvent>(`/content/admin/events/${id}`, input);
  },
  deleteEvent(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/content/admin/events/${id}`);
  },
  listEventRegistrations(eventId: string): Promise<EventRegistration[]> {
    return apiClient.get<EventRegistration[]>(`/content/admin/events/${eventId}/registrations`);
  },
  updateEventRegistration(registrationId: string, update: { status: EventRegistration['status'] }): Promise<EventRegistration> {
    return apiClient.patch<EventRegistration>(`/content/admin/event-registrations/${registrationId}`, update);
  },

  // ---------- Admin: reviews ----------

  listReviews(status?: ReviewStatus): Promise<CustomerReview[]> {
    return apiClient.get<CustomerReview[]>(`/reviews/admin${status ? `?status=${status}` : ''}`);
  },
  moderateReview(id: string, update: ReviewModerationUpdate): Promise<CustomerReview> {
    return apiClient.patch<CustomerReview>(`/reviews/admin/${id}`, update);
  },
  deleteReview(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/reviews/admin/${id}`);
  },

  // ---------- Admin: documents ----------

  listDocuments(): Promise<SiteDocument[]> {
    return apiClient.get<SiteDocument[]>('/documents/admin');
  },
  createDocument(input: SiteDocumentInput): Promise<SiteDocument> {
    return apiClient.post<SiteDocument>('/documents/admin', input);
  },
  updateDocument(id: string, input: Partial<SiteDocumentInput>): Promise<SiteDocument> {
    return apiClient.put<SiteDocument>(`/documents/admin/${id}`, input);
  },
  deleteDocument(id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/documents/admin/${id}`);
  },

  // ---------- Admin: availability ----------

  getAvailabilitySettings(): Promise<AvailabilitySettings> {
    return apiClient.get<AvailabilitySettings>('/availability/admin');
  },
  updateAvailabilitySettings(settings: AvailabilitySettings): Promise<AvailabilitySettings> {
    return apiClient.put<AvailabilitySettings>('/availability/admin', settings);
  },
};
