"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createIdeaApi } from "../../../lib/api";

export default function NewIdeaPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("웹/앱");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [requiredMembers, setRequiredMembers] = useState(3);
  const [techStackText, setTechStackText] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputClassName =
    "w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100";

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("프로젝트 주제를 입력해주세요.");
      return;
    }

    if (!summary.trim()) {
      alert("한 줄 요약을 입력해주세요.");
      return;
    }

    if (!description.trim()) {
      alert("상세 설명을 입력해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        description: description.trim(),
        domain,
        difficulty,
        required_members: Number(requiredMembers),
        tech_stack: techStackText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        hashtags: hashtagsText
          .split(",")
          .map((item) => item.trim().replace(/^#/, ""))
          .filter(Boolean),
        is_open: true,
      };

      const result = await createIdeaApi(payload);

      alert("아이디어가 등록되었습니다.");

      const ideaId = result?.data?.id;
      if (ideaId) {
        router.push(`/ideas/${ideaId}`);
      } else {
        router.push("/mainpage");
      }
    } catch (error) {
      console.error(error);
      alert("아이디어 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl rounded-2xl bg-white p-8 shadow">
        <h1 className="mb-8 text-2xl font-bold text-slate-900">
          아이디어 등록
        </h1>

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              프로젝트 주제
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Devory 앱 개발"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              한 줄 요약
            </label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="예: 아이디어를 공유하고 협업자를 구하는 플랫폼"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              상세 설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="아이디어의 목적, 주요 기능, 필요한 역할 등을 설명해주세요."
              className="min-h-40 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                관련 분야
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={inputClassName}
              >
                <option value="웹/앱">웹/앱</option>
                <option value="AI/데이터">AI/데이터</option>
                <option value="교육/학습">교육/학습</option>
                <option value="커머스/쇼핑">커머스/쇼핑</option>
                <option value="소셜/커뮤니티">소셜/커뮤니티</option>
                <option value="헬스케어">헬스케어</option>
                <option value="경영/경제">경영/경제</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                난이도
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={inputClassName}
              >
                <option value="beginner">입문</option>
                <option value="intermediate">중급</option>
                <option value="advanced">고급</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                모집 인원
              </label>
              <input
                type="number"
                min="1"
                value={requiredMembers}
                onChange={(e) => setRequiredMembers(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                기술 스택
              </label>
              <input
                value={techStackText}
                onChange={(e) => setTechStackText(e.target.value)}
                placeholder="예: React, FastAPI, PostgreSQL"
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              해시태그
            </label>
            <input
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
              placeholder="예: 협업, 초보환영, AI추천"
              className={inputClassName}
            />
            <p className="mt-2 text-sm text-slate-500">
              쉼표로 구분해서 입력해주세요.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              취소
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "등록 중..." : "등록하기"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}