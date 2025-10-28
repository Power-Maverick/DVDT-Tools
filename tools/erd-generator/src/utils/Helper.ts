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
    }
}