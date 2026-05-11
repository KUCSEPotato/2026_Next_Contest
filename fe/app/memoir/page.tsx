// MemoirPage.tsx
'use client';

import { useState } from 'react';

export default function MemoirPage() {
  const [good, setGood] = useState('');
  const [bad, setBad] = useState('');

  return (
    <div className="min-h-screen bg-red-50/40 text-red-950">
      <div className="mx-auto max-w-xl p-6">
        <h1 className="mb-6 text-2xl font-bold">🌱 성장 기록하기</h1>

        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-red-700">
            느낀 점
          </p>

          <textarea
            value={good}
            onChange={(e) => setGood(e.target.value)}
            placeholder="프로젝트를 하며 배운 점, 좋았던 경험 등을 적어주세요"
            rows={5}
            className="w-full resize-none rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-red-300"
          />
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-semibold text-red-700">
            부족했던 점
          </p>

          <textarea
            value={bad}
            onChange={(e) => setBad(e.target.value)}
            placeholder="아쉬웠던 부분, 다음에 개선하고 싶은 점을 적어주세요"
            rows={5}
            className="w-full resize-none rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-red-300"
          />
        </div>
      </div>
    </div>
  );
}
