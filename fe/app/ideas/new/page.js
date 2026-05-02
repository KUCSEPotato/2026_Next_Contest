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
  const [difficulty, setDifficulty] = useState("beginner");
  const [requiredMembers, setRequiredMembers] = useState(1);
  const [techStack, setTechStack] = useState("");
  const [hashtags, setHashtags] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      title,
      summary,
      description,
      domain,
      difficulty,
      required_members: Number(requiredMembers),
      is_open: true,
      tech_stack: techStack.split(",").map((item) => item.trim()).filter(Boolean),
      hashtags: hashtags.split(",").map((item) => item.trim()).filter(Boolean),
    };

    try {
      const result = await createIdeaApi(payload);
      console.log("아이디어 등록 성공:", result);
      alert("아이디어가 등록되었습니다.");
      router.push("/");
    } catch (error) {
      console.error(error);
      alert("아이디어 등록에 실패했습니다.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold text-blue-600">
            Devory Idea Posting
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            아이디어 등록
          </h1>
          <p className="mt-3 text-slate-600">
            함께 만들고 싶은 프로젝트 아이디어를 등록하고, 관심 있는 팀원을 모집해보세요.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <section className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                프로젝트 주제
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: Devory 앱 개발"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                한 줄 요약
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="아이디어를 짧게 설명해주세요"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                상세 설명
              </label>
              <textarea
                className="min-h-40 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트 목적, 주요 기능, 기대 효과를 적어주세요"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                관련 분야
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              >
                <option value="웹/앱">웹/앱</option>
                <option value="게임">게임</option>
                <option value="딥러닝">딥러닝</option>
                <option value="AI">AI</option>
                <option value="데이터">데이터</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                난이도
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="beginner">초급</option>
                <option value="intermediate">중급</option>
                <option value="advanced">고급</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                모집 인원
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                type="number"
                min="1"
                value={requiredMembers}
                onChange={(e) => setRequiredMembers(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                기술 스택
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="예: React, FastAPI, PostgreSQL"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                해시태그
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="예: 협업, 초보환영, AI추천"
              />
              <p className="mt-2 text-sm text-slate-500">
                쉼표로 구분해서 입력해주세요.
              </p>
            </div>
          </section>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              취소
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              등록하기
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}