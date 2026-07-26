import { AxiosInstance } from "axios";

export class Helper {
    private axiosInstance: AxiosInstance;

    constructor(axiosInstance: AxiosInstance) {
        this.axiosInstance = axiosInstance;
    }

    async getOData(query: string, isPPTB: boolean): Promise<any> {
        try {
            if (isPPTB) {
                const response = await window.dataverseAPI.queryData(query);
                return response.value as any;
            } else {
                const response = await this.axiosInstance.get(`/` + query);
                return response.data.value;
            }
        } catch (error) {
            console.error("Error fetching OData:", error);
            throw error;
        }

        async postOData(query: string, data: Record<string, unknown>, isPPTB: boolean): Promise<any> {
            try {
                if (isPPTB) {
                    if (typeof (window.dataverseAPI as any).executeRequest === "function") {
                        return await (window.dataverseAPI as any).executeRequest({
                            method: "POST",
                            path: query,
                            data,
                        });
                    }
                    throw new Error("PPTB metadata write API is not available in this host.");
                }

                const response = await this.axiosInstance.post(`/${query}`, data);
                return response.data;
            } catch (error) {
                console.error("Error posting OData:", error);
                throw error;
            }
        }

        async patchOData(query: string, data: Record<string, unknown>, isPPTB: boolean): Promise<any> {
            try {
                if (isPPTB) {
                    if (typeof (window.dataverseAPI as any).executeRequest === "function") {
                        return await (window.dataverseAPI as any).executeRequest({
                            method: "PATCH",
                            path: query,
                            data,
                        });
                    }
                    throw new Error("PPTB metadata write API is not available in this host.");
                }

                const response = await this.axiosInstance.patch(`/${query}`, data);
                return response.data;
            } catch (error) {
                console.error("Error patching OData:", error);
                throw error;
            }
        }
    }
}