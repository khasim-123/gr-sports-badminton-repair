/**
 * GR Sports Platform - Pricing & Distance Configuration Service
 * REST endpoints for dynamic free radius, per-km surcharge, and tier definitions.
 */
import { apiClient } from './apiClient';
import { DistancePricingConfig, GettingServiceTier, RepairCategoryTier } from '../types';

export const pricingService = {
  /**
   * Get dynamic distance pricing configuration
   * GET /api/config/distance
   */
  async getDistanceConfig(): Promise<DistancePricingConfig> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.get<DistancePricingConfig>('/config/distance');
    }
    const saved = localStorage.getItem('shuttlecraft_dist_config');
    return saved ? JSON.parse(saved) : null;
  },

  /**
   * Update master distance & free radius configuration
   * PUT /api/config/distance
   */
  async updateDistanceConfig(config: DistancePricingConfig): Promise<DistancePricingConfig> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.put<DistancePricingConfig>('/config/distance', config);
    }
    localStorage.setItem('shuttlecraft_dist_config', JSON.stringify(config));
    return config;
  },

  /**
   * Get all active stringing/getting service tiers
   * GET /api/config/getting-services
   */
  async getGettingServices(): Promise<GettingServiceTier[]> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.get<GettingServiceTier[]>('/config/getting-services');
    }
    const saved = localStorage.getItem('shuttlecraft_getting_services');
    return saved ? JSON.parse(saved) : [];
  },

  /**
   * Update a getting service tier
   * PUT /api/config/getting-services/:id
   */
  async updateGettingService(
    id: string,
    tier: Partial<GettingServiceTier>
  ): Promise<GettingServiceTier> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.put<GettingServiceTier>(`/config/getting-services/${id}`, tier);
    }
    return { ...tier, id } as GettingServiceTier;
  },

  /**
   * Get all active repair category tiers
   * GET /api/config/repair-categories
   */
  async getRepairCategories(): Promise<RepairCategoryTier[]> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.get<RepairCategoryTier[]>('/config/repair-categories');
    }
    const saved = localStorage.getItem('shuttlecraft_repair_categories');
    return saved ? JSON.parse(saved) : [];
  },

  /**
   * Update a repair category tier
   * PUT /api/config/repair-categories/:id
   */
  async updateRepairCategory(
    id: string,
    category: Partial<RepairCategoryTier>
  ): Promise<RepairCategoryTier> {
    if (!apiClient.isMockEnabled()) {
      return apiClient.put<RepairCategoryTier>(`/config/repair-categories/${id}`, category);
    }
    return { ...category, id } as RepairCategoryTier;
  },
};
