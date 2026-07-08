import axios from "axios";

const baseURL = import.meta.env.DEV ? "/api" : import.meta.env.VITE_BACKEND_URL;

export const axiosInstance = axios.create({
  baseURL,
});

export const request = async <T = any>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: any,
  withCredentials?: boolean,
  params?: any,
): Promise<T> => {
  try {
    const response = await axiosInstance.request<T>({
      url,
      method,
      data,
      withCredentials,
      params,
    });

    return response.data;
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message;

    throw new Error(message);
  }
};
