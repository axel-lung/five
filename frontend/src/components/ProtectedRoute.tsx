import { Navigate, Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const token = localStorage.getItem('access_token');

  return token ? (
    <Outlet />
  ) : (
    <Navigate
      to={{ pathname: '/login', state: { from: location } }}
      replace
    />
  );
};

export default ProtectedRoute;