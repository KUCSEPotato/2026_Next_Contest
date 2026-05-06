export default function CommunityPage() {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          {/* 제목 */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">자유게시판</h1>
  
            {/* 글쓰기 버튼 */}
            <a
              href="/community/new"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              글쓰기
            </a>
          </div>
  
          {/* 설명 */}
          <p className="mt-2 text-sm text-slate-500">
            자유롭게 이야기를 나누는 공간입니다.
          </p>
  
          {/* 게시글 리스트 (placeholder) */}
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">
                게시글 제목 예시
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                아직 구현되지 않은 게시판입니다.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }