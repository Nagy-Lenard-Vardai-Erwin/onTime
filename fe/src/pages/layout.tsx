import Container from "@/components/container/Container";
import Navbar from "../components/navbar/Navbar";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <Container className="flex min-h-dvh w-full flex-col">
      <Navbar />
      <Outlet />
    </Container>
  );
};

export default Layout;
