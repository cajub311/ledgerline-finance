import { RootErrorBoundary } from './src/components/RootErrorBoundary';
import FinanceApp from './src/FinanceApp';

export default function App() {
  return (
    <RootErrorBoundary>
      <FinanceApp />
    </RootErrorBoundary>
  );
}
