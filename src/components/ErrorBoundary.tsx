import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Without this, any uncaught render error (a photo/album with an unusual field, a bad image URL,
// anything) unmounts the whole React tree and leaves a blank white page with no way back except
// knowing to hit reload — this is what "trang chuyển trắng xóa" was. React only stops that
// cascade at the nearest class component implementing componentDidCatch/getDerivedStateFromError;
// there's no hook equivalent, so this has to be a class component.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught a render error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #fff5f7, #ffe4ec)',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💔</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
            Đã xảy ra lỗi khi hiển thị trang
          </h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', maxWidth: '420px' }}>
            Dữ liệu bạn vẫn an toàn — chỉ giao diện gặp sự cố. Bấm nút bên dưới để tải lại trang.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 28px',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(to right, #ff758f, #ff9a9e)',
              color: 'white',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 117, 143, 0.4)',
            }}
          >
            🔄 Tải Lại Trang
          </button>
          {this.state.error.message && (
            <p style={{ fontSize: '11px', color: '#aaa', marginTop: '20px', maxWidth: '420px', wordBreak: 'break-word' }}>
              {this.state.error.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
