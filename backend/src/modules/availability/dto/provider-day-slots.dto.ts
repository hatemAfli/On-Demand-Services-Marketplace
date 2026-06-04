export type ProviderSlotStatus = 'available' | 'reserved';

export type ProviderSlotItem = {
  time: string;
  status: ProviderSlotStatus;
};

export type ProviderDaySlotsResponse = {
  slots: ProviderSlotItem[];
};
