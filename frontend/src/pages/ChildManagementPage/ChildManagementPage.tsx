import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./ChildManagementPage.css";

import ArrowButton from "../../components/ArrowButton/arrowButton";
import Logo from "../../components/Logo/logo";
import ProfileCard from "../../components/ProfileCard/profileCard";

type Child = {
  childId: number;
  name: string;
};

type ChildrenResponse = {
  success: boolean;
  data: {
    children: Child[];
  };
  message: string | null;
};

const pageTitle = "아동 관리";
const prevButtonLabel = "이전 아동 보기";
const nextButtonLabel = "다음 아동 보기";
const paginationLabel = "아동 페이지 위치";
const emptyMessage = "등록된 아동이 아직 없어요.";

const cardsPerPage = 3;

async function getChildren(): Promise<Child[]> {
  const accessToken = localStorage.getItem("accessToken");

  const response = await fetch("/api/children", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("아동 목록 조회 실패");
  }

  const result: ChildrenResponse = await response.json();

  return result.data.children;
}

function ChildManagementPage() {
  const navigate = useNavigate();

  const [children, setChildren] = useState<Child[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const totalPages = Math.ceil(children.length / cardsPerPage);

  useEffect(() => {
    const loadChildren = async () => {
      try {
        const data = await getChildren();
        setChildren(data);
      } catch (error) {
        console.error("아동 목록 조회 오류:", error);
        alert("아동 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadChildren();
  }, []);

  useEffect(() => {
    if (children.length === 0) {
      setCurrentPage(0);
      return;
    }

    setCurrentPage((prev) => Math.min(prev, totalPages - 1));
  }, [children, totalPages]);

  const handlePrev = () => {
    if (totalPages <= 1) {
      return;
    }

    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const handleNext = () => {
    if (totalPages <= 1) {
      return;
    }

    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const handleAddChild = () => {
    navigate("/guardian/children/new");
  };

  const handleChildClick = (childId: number) => {
    navigate(`/guardian/children/${childId}`);
  };

  if (isLoading) {
    return (
      <main className="child-management-page">
        <Logo />

        <h1 className="child-management-page__title">{pageTitle}</h1>

        <p className="child-management-page__empty">
          불러오는 중...
        </p>
      </main>
    );
  }

  if (children.length === 0) {
    return (
      <main className="child-management-page">
        <Logo />

        <h1 className="child-management-page__title">{pageTitle}</h1>

        <p className="child-management-page__empty">{emptyMessage}</p>

        <button
          type="button"
          className="child-management-page__add-button"
          onClick={handleAddChild}
        >
          + 아동 추가
        </button>
      </main>
    );
  }

  return (
    <main className="child-management-page">
      <Logo />

      <h1 className="child-management-page__title">{pageTitle}</h1>

      <section className="child-management-page__carousel">
        <ArrowButton
          direction="left"
          onClick={handlePrev}
          ariaLabel={prevButtonLabel}
        />

        <div className="child-management-page__viewport">
          <div
            className="child-management-page__list"
            style={{
              transform: `translateX(-${currentPage * 100}%)`,
            }}
          >
            {Array.from({ length: totalPages }, (_, pageIndex) => {
              const pageChildren = children.slice(
                pageIndex * cardsPerPage,
                pageIndex * cardsPerPage + cardsPerPage,
              );

              return (
                <div
                  key={pageIndex}
                  className="child-management-page__slide"
                >
                  {pageChildren.map((child) => (
                    <div
                      key={child.childId}
                      className="child-management-page__card"
                      onClick={() => handleChildClick(child.childId)}
                    >
                      <ProfileCard
                        profile={{
                          id: child.childId,
                          name: child.name,
                        }}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <ArrowButton
          direction="right"
          onClick={handleNext}
          ariaLabel={nextButtonLabel}
        />
      </section>

      <div
        className="child-management-page__pagination"
        aria-label={paginationLabel}
      >
        {Array.from({ length: totalPages }, (_, index) => (
          <span
            key={index}
            className={
              index === currentPage
                ? "child-management-page__dot child-management-page__dot--active"
                : "child-management-page__dot"
            }
          />
        ))}
      </div>

      <button
        type="button"
        className="child-management-page__add-button"
        onClick={handleAddChild}
      >
        + 아동 추가
      </button>
    </main>
  );
}

export default ChildManagementPage;