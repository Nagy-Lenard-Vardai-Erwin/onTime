import {api, setAuthToken} from './config';

export type Bus = {
  id: number;
  name: string;
  line_id: number;
};

export type DriverCredentials = {
  driverName: string;
  busName: string;
  busId: number;
  lineId: number;
  token: string;
};

type LoginResponse = {
  status: string;
  token: string;
  bus: Bus;
};

export const loginDriver = async (
  driverName: string,
  password: string,
  busName: string,
): Promise<{bus: Bus; token: string}> => {
  const response = await api.post<LoginResponse>('/login', {
    email: driverName.trim(),
    password,
    bus_name: busName.trim(),
  });
  const {bus, token} = response.data ?? {};
  if (response.status !== 200 || !bus || !token) {
    throw new Error('Login failed');
  }
  setAuthToken(token);
  return {bus, token};
}
