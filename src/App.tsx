import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import './App.css';

// --- Constants ---
const TAX_RATE = 1.1;
const MIN_DUTY_FREE = 5000;
const MAX_DUTY_FREE = 500000;
const KR_FORMATTER = new Intl.NumberFormat('ko-KR');
const API_URL = 'https://open.er-api.com/v6/latest/JPY';

// --- Custom Hook ---
const useExchangeRate = () => {
  const [rate, setRate] = useState<number>(9.0); // Fallback rate
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchRate = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      if (data.result === 'success') {
        setRate(data.rates.KRW);
        setLastUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (error) {
      console.error('Failed to fetch rate:', error);
      if (!lastUpdated) {
        setLastUpdated('오류 (기본 환율 적용)');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [lastUpdated]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  return { rate, loading, isRefreshing, lastUpdated, fetchRate };
};

// --- Sub-components (Memoized) ---
const Header = memo(() => (
  <header className="header">
    <h1>🇯🇵 일본 면세 계산기 🇰🇷</h1>
  </header>
));

const RateBadge = memo(({ rate, isRefreshing, lastUpdated, onRefresh }: { 
  rate: number, isRefreshing: boolean, lastUpdated: string, onRefresh: () => void 
}) => (
  <div className="rate-container">
    <span 
      className={`rate-badge ${isRefreshing ? 'refreshing' : ''}`}
      onClick={onRefresh}
      title={`마지막 갱신: ${lastUpdated}`}
    >
      1 ¥ = {rate.toFixed(2)} ₩ {isRefreshing ? '⌛' : ''}
    </span>
  </div>
));

const JpyInput = memo(({ value, isTaxIncluded, onChange, onFocus }: {
  value: string, isTaxIncluded: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, onFocus: () => void
}) => (
  <div className="input-group">
    <div className="input-card highlight">
      <label className="input-label" htmlFor="jpy-input">
        {isTaxIncluded ? '세금 포함 금액' : '세전 금액(면세가)'}
      </label>
      <div className="input-control">
        <input
          id="jpy-input"
          type="text"
          inputMode="numeric"
          value={value ? KR_FORMATTER.format(parseInt(value)) : ''}
          onChange={onChange}
          onFocus={onFocus}
          placeholder="0"
          autoFocus
        />
        <span className="unit-symbol">¥</span>
      </div>
    </div>
  </div>
));

const ToggleGroup = memo(({ isTaxIncluded, onToggle }: {
  isTaxIncluded: boolean, onToggle: (val: boolean) => void
}) => (
  <div className="toggle-group">
    <button className={`toggle-btn ${isTaxIncluded ? 'active' : ''}`} onClick={() => onToggle(true)}>
      세금 포함 입력
    </button>
    <button className={`toggle-btn ${!isTaxIncluded ? 'active' : ''}`} onClick={() => onToggle(false)}>
      세전(면세가) 입력
    </button>
  </div>
));

// --- Main App ---
function App() {
  const [jpy, setJpy] = useState<string>('10000');
  const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  
  const { rate, loading, isRefreshing, lastUpdated, fetchRate } = useExchangeRate();

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    const numVal = parseInt(val) || 0;
    
    // 최대 7자리 (9,999,999엔)로 제한
    if (val.length <= 7 && numVal <= 9999999) {
      setJpy(val);
    }
  }, []);

  const handleFocus = useCallback(() => {
    setJpy('');
  }, []);

  const calculations = useMemo(() => {
    const inputAmount = parseInt(jpy) || 0;
    const preTaxAmount = isTaxIncluded ? Math.round(inputAmount / TAX_RATE) : inputAmount;
    const taxIncludedAmount = isTaxIncluded ? inputAmount : Math.round(inputAmount * TAX_RATE);
    
    const isBelowThreshold = preTaxAmount < MIN_DUTY_FREE && inputAmount > 0;
    const isAboveLimit = preTaxAmount > MAX_DUTY_FREE;
    const isDutyFreeEligible = !isBelowThreshold && !isAboveLimit;
    
    const finalJpy = isDutyFreeEligible ? preTaxAmount : taxIncludedAmount;
    const krwAmount = Math.round(finalJpy * rate);

    return { finalJpy, krwAmount, isBelowThreshold, isAboveLimit, isDutyFreeEligible };
  }, [jpy, isTaxIncluded, rate]);

  const { finalJpy, krwAmount, isBelowThreshold, isAboveLimit, isDutyFreeEligible } = calculations;

  const handleCopy = useCallback(() => {
    if (krwAmount > 0) {
      const textToCopy = krwAmount.toString();
      
      const copyToClipboard = async () => {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textToCopy);
            return true;
          } else {
            // Fallback: execCommand
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
          }
        } catch (err) {
          console.error('Copy failed:', err);
          return false;
        }
      };

      copyToClipboard().then((success) => {
        if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      });
    }
  }, [krwAmount]);

  return (
    <div className="container">
      <Header />

      <main className="card">
        <div className="top-row">
          {!loading && (
            <RateBadge 
              rate={rate} 
              isRefreshing={isRefreshing} 
              lastUpdated={lastUpdated} 
              onRefresh={fetchRate} 
            />
          )}
        </div>

        <JpyInput 
          value={jpy} 
          isTaxIncluded={isTaxIncluded} 
          onChange={handleInputChange} 
          onFocus={handleFocus} 
        />

        <ToggleGroup isTaxIncluded={isTaxIncluded} onToggle={setIsTaxIncluded} />

        <div className="result-section">
          <div className="result-item">
            <span>{isDutyFreeEligible ? '면세 적용 가격' : '엔화 가격'}</span>
            <span className="jpy-result">{KR_FORMATTER.format(finalJpy)} ¥</span>
          </div>
          
          <div className="result-item highlight clickable" onClick={handleCopy}>
            <div className="label-with-badge">
              <span>원화 환산 가격</span>
              {copied && <span className="copy-badge">복사됨!</span>}
            </div>
            <div className="krw-container">
              <span className="krw-result">{KR_FORMATTER.format(krwAmount)}</span>
              <span className="unit-symbol">₩</span>
            </div>
          </div>
          
          <div className="warning-area">
            {isBelowThreshold && <span className="warning-box">5,000 ¥ 미만 면세 불가</span>}
            {isAboveLimit && <span className="warning-box danger">500,000 ¥ 초과 면세 불가</span>}
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>실시간 환율 기반 (업데이트: {lastUpdated})</p>
      </footer>
    </div>
  );
}

export default App;
