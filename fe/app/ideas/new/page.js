"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createIdeaApi } from "../../../lib/api";

const CATEGORIES = [
  "IT/소프트웨어",
  "경영/경제",
  "디자인/UI·UX",
  "AI/데이터",
  "교육/학습",
  "금융/핀테크",
  "커머스/쇼핑",
  "소셜/커뮤니티",
  "헬스케어",
];

export default function NewIdeaPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("IT/소프트웨어");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [requiredMembers, setRequiredMembers] = useState(3);
  const [expectedPeriod, setExpectedPeriod] = useState("");
  const [preferredMembers, setPreferredMembers] = useState("");
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

      const fullDescription = [
        description.trim(),
        expectedPeriod.trim()
          ? `\n\n[예상 진행 기간]\n${expectedPeriod.trim()}`
          : "",
        preferredMembers.trim()
          ? `\n\n[이런 분과 함께하고 싶어요]\n${preferredMembers.trim()}`
          : "",
      ].join("");

      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        description: fullDescription,
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

      try {
        setIsSubmitting(true);
      
        // payload 만드는 코드 그대로
      
        const result = await createIdeaApi(payload);
      
        const ideaId = result?.data?.id;
        const projectId =
          result?.data?.project_id ||
          result?.data?.converted_to_project_id;
      
        alert("아이디어가 등록되었습니다.");
      
        if (projectId) {
          router.push(`/projects/${projectId}`);
        } else {
          router.push("/mainpage");
        }
      } catch (error) {
        console.error(error);
        alert("아이디어 등록에 실패했습니다.");
      } finally {
        setIsSubmitting(false);
      }

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
                프로젝트 유형
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={inputClassName}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
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
                max="100"
                value={requiredMembers}
                onChange={(e) => setRequiredMembers(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                예상 진행 기간
              </label>
              <input
                value={expectedPeriod}
                onChange={(e) => setExpectedPeriod(e.target.value)}
                placeholder="예: 3개월, 한 학기, 2026년 3월까지"
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              이런 분과 함께하고 싶어요
            </label>
            <textarea
              value={preferredMembers}
              onChange={(e) => setPreferredMembers(e.target.value)}
              placeholder="예: 백엔드 경험이 있는 분, 주 1회 이상 회의 가능한 분, 꾸준히 소통 가능한 분"
              className="min-h-28 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
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
            <p className="mt-2 text-sm text-slate-500">
              쉼표로 구분해서 입력해주세요.
            </p>
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