// The one place that decides which implementation each feature uses.
// Replace a mock here to connect a real backend.

import {
  aiProviders,
  createMockDownloads,
  mockAssistant,
  mockAutomation,
  mockPageAnalysis,
  mockSiteInfo,
  mockVpn,
} from './mock';

export const services = {
  assistant: mockAssistant,
  vpn: mockVpn,
  automation: mockAutomation,
  downloads: createMockDownloads(),
  pageAnalysis: mockPageAnalysis,
  siteInfo: mockSiteInfo,
  aiProviders,
};

export type Services = typeof services;
export type * from './types';
