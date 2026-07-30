import backgroundHills from "../assets/background_hills.svg";
import characterCover from "../assets/character.svg";
import readingBookCover from "../assets/reading_book.svg";
import type {
  RecommendedStory,
  StoryDetail,
  StoryPageInfo,
} from "../types/story";

type StorySummaryResponse = {
  originalStoryId: number;
  title: string;
  languageCode: string;
};

type StoryRecommendationApiResponse = {
  success: boolean;
  data: {
    stories: StorySummaryResponse[];
    pageInfo: StoryPageInfo;
  };
  message: string | null;
};

type StorySentenceResponse = {
  sentenceIdx: number;
  content: string;
};

type StoryPartResponse = {
  type: string;
  orderNum: number;
  sentences: StorySentenceResponse[];
};

type StoryDetailApiResponse = {
  success: boolean;
  data: {
    originalStoryId: number;
    storyLevelId: number;
    title: string;
    level: number;
    parts: StoryPartResponse[];
  };
  message: string | null;
};

type GetRecommendedStoriesParams = {
  childId: number;
  languageCode?: string;
  page?: number;
  size?: number;
};

type RecommendedStoriesResult = {
  stories: RecommendedStory[];
  pageInfo: StoryPageInfo;
};

const storyIllustrations = [
  characterCover,
  readingBookCover,
  backgroundHills,
] as const;

const storyPlaceholders = [
  {
    thumbnailSrc: characterCover,
    categoryLabel: "공룡",
  },
  {
    thumbnailSrc: readingBookCover,
    categoryLabel: "우주",
  },
  {
    thumbnailSrc: backgroundHills,
    categoryLabel: "모험",
  },
  {
    thumbnailSrc: readingBookCover,
    categoryLabel: "일상",
  },
] as const;

const mockStoryTitles = [
  "아기 공룡 돌리",
  "우주로 떠난 고양이",
  "별님을 찾는 모험",
  "반짝반짝 별의 비밀",
  "무지개 마을의 하루",
  "구름 위를 걷는 소년",
  "바다를 찾은 작은 새",
  "반짝반짝 봄 소풍",
  "숲속 음악회",
  "공룡 친구의 생일",
  "달빛 연못의 약속",
  "별빛 마을의 비밀",
] as const;

export function getMockRecommendedStories(
  page = 0,
  size = 4,
): RecommendedStoriesResult {
  const totalElements = mockStoryTitles.length;
  const totalPages = Math.ceil(totalElements / size);
  const startIndex = page * size;
  const visibleTitles = mockStoryTitles.slice(startIndex, startIndex + size);

  return {
    stories: visibleTitles.map((title, index) => {
      const placeholder =
        storyPlaceholders[(startIndex + index) % storyPlaceholders.length];

      return {
        id: startIndex + index + 1,
        title,
        languageCode: "ko",
        thumbnailSrc: placeholder.thumbnailSrc,
        categoryLabel: placeholder.categoryLabel,
      };
    }),
    pageInfo: {
      page,
      size,
      totalPages,
      totalElements,
      hasNext: page < totalPages - 1,
      hasPrevious: page > 0,
    },
  };
}

// export function getMockStoryDetail(originalStoryId = 1): StoryDetail {
//   const title = mockStoryTitles[(originalStoryId - 1) % mockStoryTitles.length];

//   return {
//     originalStoryId,
//     storyLevelId: originalStoryId * 10,
//     title,
//     level: 1,
//     illustrationSrc:
//       storyIllustrations[(originalStoryId - 1) % storyIllustrations.length],
//     parts: [
//       {
//         type: "서론",
//         orderNum: 1,
//         sentences: [
//           {
//             sentenceIdx: 1,
//             content: "돌리가 엉엉 울었어요.",
//           },
//           {
//             sentenceIdx: 2,
//             content: "그리고 엄마 손을 꼭 잡았어요.",
//           },
//         ],
//       },
//       {
//         type: "본론",
//         orderNum: 2,
//         sentences: [
//           {
//             sentenceIdx: 1,
//             content: "엄마는 돌리 옆에 쪼그려 앉았어요.",
//           },
//           {
//             sentenceIdx: 2,
//             content: "그리고 돌리의 젖은 앞머리를 살며시 넘겨 주었어요.",
//           },
//           {
//             sentenceIdx: 3,
//             content: '"많이 속상했구나."',
//           },
//         ],
//       },
//       {
//         type: "결론",
//         orderNum: 3,
//         sentences: [
//           {
//             sentenceIdx: 1,
//             content: "돌리는 조금씩 마음이 편안해졌어요.",
//           },
//           {
//             sentenceIdx: 2,
//             content: "그리고 다시 환하게 웃을 수 있었답니다.",
//           },
//         ],
//       },
//     ],
//   };
// }




// const testStorySentences = [
//   "지금 분홍 치마를 쭈욱 다리고 있어요!",
//   "우와!",
//   "멋져요!",
//   "그 아래에서 모두 차려 놓았대!",
//   "우와!",
//   "너무 기뻐!",
//   "와!",
//   "예쁜 꽃이 진달래꽃이랑 개나리꽃이랑 모두 모여 있었어요!",
//   "날이 밝으면 좋은 세상이 와요!",
//   "모두 우르르 새 옷을 입어요!",
//   "할미꽃이 이슬로 술을 꿀꺽꿀꺽 담가요!",
//   "개나리는 황금색 휘장을 후두둑 둘러쳐요!",
//   "아기꽃들이 앉아서 기다려요!",
//   "날이 밝기를 설레는 마음으로요!",
//   "슬며시 나타난 ‘따르릉 따르릉’ 조그만 인력거가 등불을 켜고 왔어요!",
//   "인력거꾼은 개구리였어요!",
//   '"쿵쿵" 뛰어오르고 "왕왕" 울었답니다!',
//   "인력거를 타고 온 손님은 참새 색시예요!",
//   '"짹짹" 노래를 부르며 오고 있어요!',
//   '"어머나!" 꽃들이 놀래서 모여들었어요.',
//   '"왜 이렇게 갑자기 왔어요?" 하고 물었답니다!',
//   "참새가 말했어요!",
//   '"짜잔!" 준비하자!',
//   "제비와 종달새는 기다리고 있었어요.",
//   '하지만 꾀꼬리가 "아악!" 아프다고 해요!',
//   '"에그!" 걱정했어요.',
//   '"내일 꾀꼬리가 못 오면 어쩌지?" 좋은 꿀을 한 그릇 준비했어요!',
//   '"약으로 먹어봐!" 하고 보내줬어요!',
//   '참새 색시는 꿀을 "꼬르륵" 받아가고, 인력거를 타고 "후다닥" 급히 돌아갔어요!',
//   "참새가 돌아간 후 조금 있다가 '따르릉 따르릉'하며 불 켠 자전거가 '휘몰아' 왔어요!",
//   '자전거를 타고 "쌔~~~" 제비가 다리 쭉 뻗고 왔어요!',
//   "“어이구! 수고했어요!” “정말 애를 썼어요!” 꽃들이 일하면서 “아자아자!” 응원했어요!",
//   '제비가 "쌔~~~" 날아가며 꽃과 벌레를 "쿨쿨" 자고 있는 것들을 깨웠어요!',
//   '"와~ 맛있겠다!" "짭짭" 이슬술 한 잔 받아 마시고 정말 신났어요!',
//   '동네 어딘가에서 "딩동딩!" 시계 소리가 들려왔어요.',
//   '나비가 "나비들이 다 무도복을 입고 기다리고 있어요!"라며 알려주고는 후루룩 날아갔어요!',
// ];

type TestStoryPage = {
  pageNum: number;
  sentences: string[];
};

export const testStoryPages: TestStoryPage[] = [
  {
    pageNum: 1,
    sentences: [
      "지금 분홍 치마를 쭈욱 다리고 있어요!",
      "우와!",
      "멋져요!",
      "그 아래에서 모두 차려 놓았대!",
      "우와!",
      "너무 기뻐!",
      "와!",
    ],
  },
  {
    pageNum: 2,
    sentences: [
      "예쁜 꽃이 진달래꽃이랑 개나리꽃이랑 모두 모여 있었어요!",
      "날이 밝으면 좋은 세상이 와요!",
      "모두 우르르 새 옷을 입어요!",
      "할미꽃이 이슬로 술을 꿀꺽꿀꺽 담가요!",
      "개나리는 황금색 휘장을 후두둑 둘러쳐요!",
    ],
  },
  {
    pageNum: 3,
    sentences: [
      "아기꽃들이 앉아서 기다려요!",
      "날이 밝기를 설레는 마음으로요!",
      "슬며시 나타난 ‘따르릉 따르릉’ 조그만 인력거가 등불을 켜고 왔어요!",
      "인력거꾼은 개구리였어요!",
      '"쿵쿵" 뛰어오르고 "왕왕" 울었답니다!',
    ],
  },
  {
    pageNum: 4,
    sentences: [
      "인력거를 타고 온 손님은 참새 색시예요!",
      '"짹짹" 노래를 부르며 오고 있어요!',
      '"어머나!" 꽃들이 놀래서 모여들었어요.',
      '"왜 이렇게 갑자기 왔어요?" 하고 물었답니다!',
      "참새가 말했어요!",
      '"짜잔!" 준비하자!',
    ],
  },
  {
    pageNum: 5,
    sentences: [
      "제비와 종달새는 기다리고 있었어요.",
      '하지만 꾀꼬리가 "아악!" 아프다고 해요!',
      '"에그!" 걱정했어요.',
      '"내일 꾀꼬리가 못 오면 어쩌지?" 좋은 꿀을 한 그릇 준비했어요!',
      '"약으로 먹어봐!" 하고 보내줬어요!',
    ],
  },
  {
    pageNum: 6,
    sentences: [
      '참새 색시는 꿀을 "꼬르륵" 받아가고, 인력거를 타고 "후다닥" 급히 돌아갔어요!',
      "참새가 돌아간 후 조금 있다가 '따르릉 따르릉'하며 불 켠 자전거가 '휘몰아' 왔어요!",
      '자전거를 타고 "쌔~~~" 제비가 다리 쭉 뻗고 왔어요!',
    ],
  },
  {
    pageNum: 7,
    sentences: [
      "“어이구! 수고했어요!” “정말 애를 썼어요!” 꽃들이 일하면서 “아자아자!” 응원했어요!",
      '제비가 "쌔~~~" 날아가며 꽃과 벌레를 "쿨쿨" 자고 있는 것들을 깨웠어요!',
      '"와~ 맛있겠다!" "짭짭" 이슬술 한 잔 받아 마시고 정말 신났어요!',
    ],
  },
  {
    pageNum: 8,
    sentences: [
      '동네 어딘가에서 "딩동딩!" 시계 소리가 들려왔어요.',
      '나비가 "나비들이 다 무도복을 입고 기다리고 있어요!"라며 알려주고는 후루룩 날아갔어요!',
    ],
  },
];


export function getMockStoryDetail(originalStoryId = 1): StoryDetail {
  const title =
    mockStoryTitles[(originalStoryId - 1) % mockStoryTitles.length];

  return {
    originalStoryId,
    storyLevelId: originalStoryId * 10,
    title,
    level: 1,
    illustrationSrc:
      storyIllustrations[(originalStoryId - 1) % storyIllustrations.length],

    parts: [
      {
        type: "서론",
        orderNum: 1,
        sentences: testStorySentences.map((content, index) => ({
          sentenceIdx: index + 1,
          content,
        })),
      },
      {
        type: "본론",
        orderNum: 2,
        sentences: [
          {
            sentenceIdx: 1,
            content: "본론 테스트 문장입니다.",
          },
        ],
      },
      {
        type: "결론",
        orderNum: 3,
        sentences: [
          {
            sentenceIdx: 1,
            content: "결론 테스트 문장입니다.",
          },
        ],
      },
    ],
  };
}

export async function getRecommendedStories({
  childId,
  languageCode = "ko",
  page = 0,
  size = 4,
}: GetRecommendedStoriesParams): Promise<RecommendedStoriesResult> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const searchParams = new URLSearchParams({
    childId: String(childId),
    languageCode,
    page: String(page),
    size: String(size),
  });

  const response = await fetch(
    `/api/stories/recommendations?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("추천 동화 목록 조회 실패");
  }

  const result: StoryRecommendationApiResponse = await response.json();

  return {
    stories: result.data.stories.map((story, index) => {
      const placeholder = storyPlaceholders[index % storyPlaceholders.length];

      return {
        id: story.originalStoryId,
        title: story.title,
        languageCode: story.languageCode,
        thumbnailSrc: placeholder.thumbnailSrc,
        categoryLabel: placeholder.categoryLabel,
      };
    }),
    pageInfo: result.data.pageInfo,
  };
}

export async function getStoryDetail(
  originalStoryId: number,
  level = 1,
): Promise<StoryDetail> {
  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    throw new Error("로그인이 필요합니다.");
  }

  const response = await fetch(`/api/stories/${originalStoryId}?level=${level}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("동화 내용 조회 실패");
  }

  const result: StoryDetailApiResponse = await response.json();

  return {
    originalStoryId: result.data.originalStoryId,
    storyLevelId: result.data.storyLevelId,
    title: result.data.title,
    level: result.data.level,
    parts: result.data.parts,
    illustrationSrc:
      storyIllustrations[
      (result.data.originalStoryId - 1) % storyIllustrations.length
      ],
  };
}
