import {
  ApiHealthResponse,
  StorageNode,
  ClusterHealthSummary,
  SystemEvent,
  StoredObject,
  StoredObjectDetail
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    };

    // Only set Content-Type to application/json if not sending FormData
    if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData?.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // Response body was not JSON
        }
        throw new Error(errorMessage);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('An unknown network error occurred');
    }
  }

  /**
   * Health check for Vault API
   */
  async getHealth(): Promise<ApiHealthResponse> {
    return this.request<ApiHealthResponse>('/health');
  }

  /**
   * Fetch all registered storage nodes
   */
  async getNodes(): Promise<StorageNode[]> {
    return this.request<StorageNode[]>('/nodes');
  }

  /**
   * Fetch aggregate cluster health status
   */
  async getClusterHealth(): Promise<ClusterHealthSummary> {
    return this.request<ClusterHealthSummary>('/cluster/health');
  }

  /**
   * Fetch recent cluster activity events
   */
  async getRecentEvents(limit = 10): Promise<SystemEvent[]> {
    return this.request<SystemEvent[]>(`/cluster/events?limit=${limit}`);
  }

  /**
   * Upload an object file to Vault
   */
  async uploadObject(file: File): Promise<StoredObjectDetail> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<StoredObjectDetail>('/objects', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * List all stored objects
   */
  async listObjects(): Promise<StoredObject[]> {
    return this.request<StoredObject[]>('/objects');
  }

  /**
   * Fetch metadata and replicas for a single object
   */
  async getObject(id: string): Promise<StoredObjectDetail> {
    return this.request<StoredObjectDetail>(`/objects/${id}`);
  }

  /**
   * Download object file and trigger browser save dialog
   */
  async downloadObject(id: string, filename: string): Promise<void> {
    const url = `${API_BASE_URL}/objects/${id}/download`;
    const response = await fetch(url);
    if (!response.ok) {
      let msg = `Download failed: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) msg = errJson.error.message;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || `vault-object-${id}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  }

  /**
   * Delete an object from Vault
   */
  async deleteObject(id: string): Promise<{ success: boolean; id: string; name: string }> {
    return this.request<{ success: boolean; id: string; name: string }>(`/objects/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Trigger replication of an object across healthy storage nodes
   */
  async replicateObject(id: string): Promise<import('./types').ReplicationResult> {
    return this.request<import('./types').ReplicationResult>(`/objects/${id}/replicate`, {
      method: 'POST',
    });
  }

  /**
   * Trigger repair of a degraded object across healthy storage nodes
   */
  async repairObject(id: string): Promise<import('./types').RepairResult> {
    return this.request<import('./types').RepairResult>(`/objects/${id}/repair`, {
      method: 'POST',
    });
  }

  /**
   * Fetch detailed replica records for an object
   */
  async getObjectReplicas(id: string): Promise<import('./types').ObjectReplica[]> {
    return this.request<import('./types').ObjectReplica[]>(`/objects/${id}/replicas`);
  }

  /**
   * Simulate failure of a storage node
   */
  async failNode(id: string): Promise<import('./types').NodeFailureResult> {
    return this.request<import('./types').NodeFailureResult>(`/nodes/${id}/fail`, {
      method: 'POST',
    });
  }

  /**
   * Recover a failed storage node
   */
  async recoverNode(id: string): Promise<import('./types').NodeRecoveryResult> {
    return this.request<import('./types').NodeRecoveryResult>(`/nodes/${id}/recover`, {
      method: 'POST',
    });
  }

  /**
   * Simulate corruption of a specific replica
   */
  async corruptReplica(
    objectId: string,
    nodeId: string
  ): Promise<{ objectId: string; nodeId: string; nodeName: string; status: string; message: string }> {
    return this.request<{ objectId: string; nodeId: string; nodeName: string; status: string; message: string }>(
      `/objects/${objectId}/replicas/${nodeId}/corrupt`,
      {
        method: 'POST',
      }
    );
  }
}

export const vaultApi = new ApiClient();
