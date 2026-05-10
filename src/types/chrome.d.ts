declare namespace chrome {
  namespace runtime {
    interface MessageSender {}
    const onInstalled: { addListener(callback: () => void): void };
    const onMessage: {
      addListener(callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void | boolean): void;
      removeListener(callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void | boolean): void;
    };
    function sendMessage(message: any): Promise<any>;
    function openOptionsPage(): Promise<void>;
  }
  namespace storage {
    interface StorageChange { oldValue?: any; newValue?: any; }
    interface StorageArea {
      get(keys?: string | string[] | Record<string, any> | null): Promise<Record<string, any>>;
      set(items: Record<string, any>): Promise<void>;
    }
    const local: StorageArea;
    const onChanged: {
      addListener(callback: (changes: Record<string, StorageChange>, areaName: string) => void): void;
      removeListener(callback: (changes: Record<string, StorageChange>, areaName: string) => void): void;
    };
  }
}
