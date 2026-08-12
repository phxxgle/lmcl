/* ═══════════════════════════════════════════════════════════════
   data.js — DỮ LIỆU GIẢI ĐẤU & VẬN ĐỘNG VIÊN
   Đây là file bạn sửa mỗi khi sang mùa giải mới.
   Nạp TRƯỚC app.js (xem thứ tự thẻ script trong index.html).
   ═══════════════════════════════════════════════════════════════ */

const ROSTERS = {
  nam: [
    "Vương Mạnh Chuyền",
    "Chu Văn Huynh",
    "Phạm Minh Quân",
    "Nguyễn Văn Thành",
    "Nguyễn Đình Đạt",
    "Trần Trung Hiếu",
    "Nguyễn Tiến Trung"
  ],
  nu: [
    "Nguyễn Đan Quyên",
    "Lê Thanh Phương",
    "Vũ Ngọc Linh",
    "Bùi Huyền Trang",
    "Đặng Thị Nhung"
  ]
};

// Dữ liệu các mùa giải cho mục "Tournament".
// - status "live": giải đang diễn ra, bấm vào sẽ mở tab Live Match.
// - status "finished": giải đã kết thúc, kèm mảng standings để hiển thị bảng xếp hạng cuối giải.
//   change: số bậc thay đổi so với giải liền trước (0 = giữ nguyên).
const TOUR_DATA = {
  2026: [
    {
      id: "lmcl-aug-2026",
      name: "LMCL Allstars — August 2026",
      titleLines: ["LMCL", "ALLSTARS", "RANKINGS"],
      badge: "AUGUST 2026",
      status: "live",
      note: "Đang diễn ra"
    },
    {
      id: "lmcl-jun-2026",
      name: "LMCL Allstars — June 2026",
      titleLines: ["LMCL", "ALLSTARS", "RANKINGS"],
      badge: "JUNE 2026",
      status: "finished",
      note: "Đã kết thúc — Tháng 6",
      // Kết quả từng hạng mục. teams: các cặp đôi; matches: {a, b, sa, sb} với a/b là chỉ số đội.
      events: {
        md: {
          label: "MD",
          title: "Đôi Nam",
          date: "5 – 12/06/2026",
          rowClass: "row-nam",
          teams: [
            ["Trần Trung Hiếu", "Nguyễn Tiến Trung"],
            ["Chu Văn Huynh", "Phạm Minh Quân"],
            ["Vương Mạnh Chuyền", "Nguyễn Văn Thành"]
          ],
          matches: [
            { a: 0, b: 1, sa: 12, sb: 21 },
            { a: 2, b: 0, sa: 21, sb: 17 },
            { a: 1, b: 2, sa: 22, sb: 20 }
          ]
        },
        wd: {
          label: "WD",
          title: "Đôi Nữ",
          date: "5 – 12/06/2026",
          rowClass: "row-nu",
          teams: [
            ["Bùi Huyền Trang", "Đặng Thị Nhung"],
            ["Lê Thanh Phương", "Nguyễn Đan Quyên"],
            ["Vũ Ngọc Linh", "Nguyễn Đình Đạt"]
          ],
          matches: [
            { a: 0, b: 1, sa: 17, sb: 21 },
            { a: 2, b: 0, sa: 21, sb: 16 },
            { a: 1, b: 2, sa: 21, sb: 17 }
          ]
        },
        xd: {
          label: "XD",
          title: "Đôi Nam Nữ",
          date: "5 – 12/06/2026",
          rowClass: "row-xd",
          teams: [
            ["Bùi Huyền Trang", "Nguyễn Tiến Trung"],
            ["Trần Trung Hiếu", "Đặng Thị Nhung"],
            ["Phạm Minh Quân", "Nguyễn Đình Đạt"],
            ["Nguyễn Văn Thành", "Nguyễn Đan Quyên"],
            ["Chu Văn Huynh", "Vũ Ngọc Linh"],
            ["Lê Thanh Phương", "Vương Mạnh Chuyền"]
          ],
          matches: [
            { a: 0, b: 1, sa: 19, sb: 21 },
            { a: 2, b: 3, sa: 21, sb: 18 },
            { a: 4, b: 2, sa: 21, sb: 10 },
            { a: 3, b: 0, sa: 21, sb: 13 },
            { a: 5, b: 1, sa: 21, sb: 15 },
            { a: 1, b: 3, sa: 15, sb: 21 },
            { a: 5, b: 0, sa: 21, sb: 15 },
            { a: 0, b: 2, sa: 17, sb: 21 },
            { a: 5, b: 3, sa: 21, sb: 12 },
            { a: 4, b: 0, sa: 21, sb: 14 },
            { a: 5, b: 2, sa: 26, sb: 24 },
            { a: 3, b: 4, sa: 16, sb: 21 },
            { a: 1, b: 4, sa: 15, sb: 21 },
            { a: 5, b: 4, sa: 24, sb: 22 },
            { a: 1, b: 2, sa: 14, sb: 21 }
          ],
          // Hạng mục này xếp hạng theo thể thức riêng, chỉ hiển thị top 3.
          // showFullStats: true → hiển thị P/W/L/PF/PA/DIFF trong bảng standings.
          finalRanking: [
            { rank: 1, t: 5 },
            { rank: 2, t: 4 },
            { rank: 3, t: 3 }
          ],
          showFullStats: true
        }
      },
      standings: [
        { name: "Nguyễn Đan Quyên",   points: 12, change:  0 },
        { name: "Vương Mạnh Chuyền",  points: 11, change:  0 },
        { name: "Lê Thanh Phương",    points: 11, change:  2 },
        { name: "Chu Văn Huynh",      points: 10, change:  0 },
        { name: "Phạm Minh Quân",     points:  9, change: -2 },
        { name: "Vũ Ngọc Linh",       points:  9, change:  0 },
        { name: "Nguyễn Văn Thành",   points:  6, change:  5 },
        { name: "Nguyễn Đình Đạt",    points:  5, change:  3 },
        { name: "Bùi Huyền Trang",    points:  5, change: -2 },
        { name: "Đặng Thị Nhung",     points:  5, change: -2 },
        { name: "Trần Trung Hiếu",    points:  4, change: -2 },
        { name: "Nguyễn Tiến Trung",  points:  4, change: -2 }
      ]
    },
    {
      id: "lmcl-jan-2026",
      name: "LMCL Allstars — January 2026",
      titleLines: ["LMCL", "ALLSTARS", "RANKINGS"],
      badge: "JANUARY 2026",
      status: "finished",
      note: "Đã kết thúc — Tháng 1",
      events: {
        md: {
          label: "MD",
          title: "Đôi Nam",
          rowClass: "row-nam",
          teams: [
            ["Vương Mạnh Chuyền", "Trần Trung Hiếu"],
            ["Chu Văn Huynh", "Phạm Minh Quân"],
            ["Nguyễn Đan Quyên", "Nguyễn Văn Thành"]
          ],
          matches: [],
          finalRanking: [
            { rank: 1, t: 0 },
            { rank: 2, t: 1 },
            { rank: 3, t: 2 }
          ],
          showFullStats: false
        },
        wd: {
          label: "WD",
          title: "Đôi Nữ",
          rowClass: "row-nu",
          teams: [
            ["Lê Thanh Phương", "Nguyễn Đình Đạt"],
            ["Vũ Ngọc Linh", "Đặng Thị Nhung"],
            ["Bùi Huyền Trang", "Nguyễn Ngọc Bích"]
          ],
          matches: [],
          finalRanking: [
            { rank: 1, t: 0 },
            { rank: 2, t: 1 },
            { rank: 3, t: 2 }
          ],
          showFullStats: false
        },
        xd: {
          label: "XD",
          title: "Đôi Nam Nữ",
          rowClass: "row-xd",
          teams: [
            ["Nguyễn Đan Quyên", "Vương Mạnh Chuyền"],
            ["Phạm Minh Quân", "Vũ Ngọc Linh"],
            ["Nguyễn Văn Thành", "Nguyễn Ngọc Bích"]
          ],
          matches: [],
          finalRanking: [
            { rank: 1, t: 0 },
            { rank: 2, t: 1 },
            { rank: 3, t: 2 }
          ],
          showFullStats: false
        }
      },
      // Change tính theo chênh lệch thứ hạng so với bảng tích luỹ cuối Season 2025.
      // Người chưa có trong bảng 2025 là gương mặt mới nên để 0 (hiển thị "–").
      standings: [
        { name: "Nguyễn Đan Quyên",   points: 8, change:  0 },
        { name: "Vương Mạnh Chuyền",  points: 6, change:  0 },
        { name: "Phạm Minh Quân",     points: 6, change:  4 },
        { name: "Chu Văn Huynh",      points: 5, change: -2 },
        { name: "Lê Thanh Phương",    points: 5, change:  1 },
        { name: "Vũ Ngọc Linh",       points: 5, change:  3 },
        { name: "Bùi Huyền Trang",    points: 4, change: -4 },
        { name: "Đặng Thị Nhung",     points: 4, change:  0 },
        { name: "Trần Trung Hiếu",    points: 3, change:  3 },
        { name: "Nguyễn Tiến Trung",  points: 3, change: -6 },
        { name: "Nguyễn Đình Đạt",    points: 3, change:  0 },
        { name: "Nguyễn Văn Thành",   points: 3, change: -2 },
        { name: "Nguyễn Ngọc Bích",   points: 2, change:  0 }
      ]
    }
  ],
  2025: [
    {
      id: "lmcl-2025",
      name: "LMCL Allstars — 2025",
      titleLines: ["LMCL", "ALLSTARS", "RANKINGS"],
      badge: "2025",
      status: "finished",
      note: "Đã kết thúc",
      events: {
        xd: {
          label: "XD",
          title: "Đôi Nam Nữ",
          rowClass: "row-xd",
          teams: [
            ["Nguyễn Đan Quyên", "Đặng Văn Hoàng"],
            ["Lê Thanh Phương", "Nguyễn Tiến Trung"],
            ["Vũ Ngọc Linh", "Nguyễn Văn Thành"]
          ],
          matches: [],
          finalRanking: [
            { rank: 1, t: 0 },
            { rank: 2, t: 1 },
            { rank: 3, t: 2 }
          ],
          showFullStats: false
        }
      },
      // Bảng tích luỹ cuối Season 2025 = điểm Season 2024 + điểm Season 2025.
      // Đặng Văn Hoàng và Nguyễn Ngọc Bích đã nghỉ thi đấu sau mùa này.
      // Chỉ tính Change cho người đã có điểm ở Season 2024 (tức có mốc hạng thực sự).
      // Người 2024 chưa có điểm thì để 0 → hiển thị "–".
      standings: [
        { name: "Nguyễn Đan Quyên",   points: 4, change:  4 },
        { name: "Chu Văn Huynh",      points: 3, change: -1 },
        { name: "Bùi Huyền Trang",    points: 3, change: -1 },
        { name: "Nguyễn Tiến Trung",  points: 3, change:  2 },
        { name: "Đặng Văn Hoàng",     points: 3, change:  0 },
        { name: "Lê Thanh Phương",    points: 2, change:  0 },
        { name: "Phạm Minh Quân",     points: 2, change: -4 },
        { name: "Đặng Thị Nhung",     points: 2, change: -4 },
        { name: "Vũ Ngọc Linh",       points: 1, change:  0 },
        { name: "Nguyễn Văn Thành",   points: 1, change:  0 },
        { name: "Nguyễn Đình Đạt",    points: 0, change:  0 },
        { name: "Trần Trung Hiếu",    points: 0, change:  0 },
        { name: "Nguyễn Ngọc Bích",   points: 0, change:  0 }
      ]
    }
  ],
  2024: [
    {
      id: "lmcl-2024",
      name: "LMCL Allstars — 2024",
      titleLines: ["LMCL", "ALLSTARS", "RANKINGS"],
      badge: "2024",
      status: "finished",
      note: "Đã kết thúc",
      events: {
        xd: {
          label: "XD",
          title: "Đôi Nam Nữ",
          rowClass: "row-xd",
          teams: [
            ["Bùi Huyền Trang", "Chu Văn Huynh"],
            ["Phạm Minh Quân", "Đặng Thị Nhung"],
            ["Nguyễn Đan Quyên", "Nguyễn Tiến Trung"]
          ],
          matches: [],
          finalRanking: [
            { rank: 1, t: 0 },
            { rank: 2, t: 1 },
            { rank: 3, t: 2 }
          ],
          showFullStats: false
        }
      },
      // Mùa giải đầu tiên — chỉ có XD. Change = 0 vì chưa có mốc trước.
      standings: [
        { name: "Chu Văn Huynh",      points: 3, change: 0 },
        { name: "Bùi Huyền Trang",    points: 3, change: 0 },
        { name: "Phạm Minh Quân",     points: 2, change: 0 },
        { name: "Đặng Thị Nhung",     points: 2, change: 0 },
        { name: "Nguyễn Đan Quyên",   points: 1, change: 0 },
        { name: "Nguyễn Tiến Trung",  points: 1, change: 0 },
        { name: "Lê Thanh Phương",    points: 0, change: 0 },
        { name: "Vũ Ngọc Linh",       points: 0, change: 0 },
        { name: "Nguyễn Văn Thành",   points: 0, change: 0 },
        { name: "Nguyễn Đình Đạt",    points: 0, change: 0 },
        { name: "Trần Trung Hiếu",    points: 0, change: 0 },
        { name: "Đặng Văn Hoàng",     points: 0, change: 0 },
        { name: "Nguyễn Ngọc Bích",   points: 0, change: 0 }
      ]
    }
  ]
};

// Giải đang diễn ra — quyết định phần chữ hiển thị ở mục Live Match.
const CURRENT_TOURNAMENT = TOUR_DATA[2026][0];

// ═══════════════════════════════════════════════════════════════
//  CÔNG TẮC MÙA GIẢI — đổi đúng dòng này khi chuyển mùa
//    'live' = đang có giải, hiện bảng chấm điểm như bình thường
//    'idle' = chưa có giải, hiện màn hình "Coming soon"
//  Chuyển sang 'idle' KHÔNG xoá gì cả, code chấm điểm vẫn nằm nguyên.
// ═══════════════════════════════════════════════════════════════
const SEASON_STATUS = 'live';

// Giải liền trước (June 2026) là điểm xuất phát của bảng xếp hạng hiện tại:
// điểm và thứ hạng của nó được cộng thêm 3/2/1 cho top 3 mỗi nội dung khi giải mới kết thúc.
const PREVIOUS_TOURNAMENT = TOUR_DATA[2026].find(t => t.id === "lmcl-jun-2026");
const OVERALL_DATA = PREVIOUS_TOURNAMENT.standings.map(r => ({ name: r.name, points: r.points }));

// Dữ liệu hồ sơ vận động viên cho mục "Members". Chỉnh sửa các trường bên dưới
// (year: năm sinh, hometown: quê quán, achievements: thành tích, photo: URL ảnh) cho từng người.
// Hồ sơ vận động viên cho Player Directory.
// dob: ngày/năm sinh · hometown: quê quán · nation: quốc gia
// flag: "vn" dùng cờ Việt Nam vẽ sẵn, hoặc điền URL ảnh cờ riêng
// achievements: thành tích · photo: URL ảnh đại diện (bỏ trống → avatar mặc định)
const THANH_HOA_FLAG = "https://i.ibb.co/B215T1x3/Untitled-1.png";

const MEMBERS_DATA = {
  nam: {
    "Vương Mạnh Chuyền": { dob: "12/08/2003", hometown: "Tuyên Quang", nation: "Việt Nam", flag: "vn", racket: "Felet Woven 100 Pro", achievements: "—", photo: "https://i.ibb.co/FQxVx4N/Chuy-n.jpg" },
    "Chu Văn Huynh":     { dob: "03/06/1997", nickname: "HuynhCv Killer - Một cú đánh, một điểm, một chiến thắng", hometown: "Hưng Yên",    nation: "Việt Nam", flag: "vn", racket: "Lining Halbertec 5000", achievements: "—", photo: "https://i.ibb.co/JjRtSg6W/Huynh.jpg" },
    "Phạm Minh Quân":    { dob: "29/08/2000", nickname: "Hip", hometown: "Vĩnh Phúc",   nation: "Việt Nam", flag: "vn", racket: "Lining Calibar 300B", achievements: "—", photo: "https://i.ibb.co/Y74Cr5ss/quan.jpg" },
    "Nguyễn Văn Thành":  { dob: "24/05/1999", nickname: "Máy đập Triều Khúc", hometown: "Vĩnh Phúc",   nation: "Việt Nam", flag: "vn", racket: "Victor Thruster HMR Pro", achievements: "—", photo: "https://i.ibb.co/tpWWKfZ1/721994941-1543834223944576-8900834826304262725-n.jpg" },
    "Nguyễn Đình Đạt":   { dob: "07/12/1997", nickname: "Bu", hometown: "Hà Nội",      nation: "Việt Nam", flag: "vn", racket: "Lining", achievements: "—", photo: "https://i.ibb.co/Ng8bhcQz/720570623-1620423832370521-1957694868907008340-n.jpg" },
    "Trần Trung Hiếu":   { dob: "20/01/1997", nickname: "Người Việt bay mà ko cần cánh", hometown: "Quảng Ninh",  nation: "Việt Nam", flag: "vn", racket: "Victor Auraspeed FD A (Phi Tiêu Dao)", achievements: "—", photo: "https://i.ibb.co/zVqZ8XLZ/716930520-1626252805150868-5081195298887915256-n.jpg" },
    "Nguyễn Tiến Trung": { dob: "01/07/1997", hometown: "Republic of Thanh Hóa", nation: "Republic of Thanh Hóa", flags: [THANH_HOA_FLAG, "vn"], racket: "Lining", achievements: "—", photo: "https://i.ibb.co/1gskRFn/720099861-1008256104923798-5542720558816907950-n.jpg" }
  },
  nu: {
    "Nguyễn Đan Quyên":  { dob: "08/03/2005", nickname: "Chip", hometown: "Quảng Ninh",  nation: "Việt Nam", flag: "vn", racket: "Proace Sweetsport 800", achievements: "—", photo: "https://i.ibb.co/bgprLybp/QUyen.jpg" },
    "Lê Thanh Phương":   { dob: "19/12/1996", hometown: "Hà Nội",      nation: "Việt Nam", flag: "vn", racket: "Yonex Nanoflare 700 Game", achievements: "—", photo: "https://i.ibb.co/8gF63ZPX/Phuong.jpg" },
    "Vũ Ngọc Linh":      { dob: "20/02/1998", hometown: "Quảng Ninh",  nation: "Việt Nam", flag: "vn", racket: "Victor BS12 SE 55TH Limited", achievements: "—", photo: "https://i.ibb.co/8LvcDmPR/718659419-1589001649328004-6981631338756931634-n.jpg" },
    "Bùi Huyền Trang":   { dob: "12/08/1997", nickname: "Shida Sharapova", hometown: "Hòa Bình",    nation: "Việt Nam", flag: "vn", racket: "Lining Windstorm 79S", achievements: "—", photo: "https://i.ibb.co/hQ4qNqd/717185999-1725763642101341-7406834729885665162-n.jpg" },
    "Đặng Thị Nhung":    { dob: "03/08/1999", nickname: "Nhung Di", hometown: "Hưng Yên",    nation: "Việt Nam", flag: "vn", racket: "Lining Bladex Spiral", achievements: "—", photo: "https://i.ibb.co/j91D1NDF/722908557-1661304405127994-631551005197498279-n.jpg" }
  }
};

const DAY1_COUNT = 15;
const CUSTOM_MATCH_ORDER = [
  ["Trần Trung Hiếu", "Nguyễn Văn Thành"],
  ["Bùi Huyền Trang", "Đặng Thị Nhung"],
  ["Nguyễn Tiến Trung", "Vương Mạnh Chuyền"],
  ["Vũ Ngọc Linh", "Đặng Thị Nhung"],
  ["Chu Văn Huynh", "Nguyễn Văn Thành"],
  ["Bùi Huyền Trang", "Lê Thanh Phương"],
  ["Trần Trung Hiếu", "Vương Mạnh Chuyền"],
  ["Vũ Ngọc Linh", "Bùi Huyền Trang"],
  ["Nguyễn Đình Đạt", "Chu Văn Huynh"],
  ["Đặng Thị Nhung", "Lê Thanh Phương"],
  ["Trần Trung Hiếu", "Nguyễn Tiến Trung"],
  ["Vũ Ngọc Linh", "Lê Thanh Phương"],
  ["Chu Văn Huynh", "Vương Mạnh Chuyền"],
  ["Nguyễn Đình Đạt", "Nguyễn Văn Thành"],
  ["Trần Trung Hiếu", "Chu Văn Huynh"],
  ["Nguyễn Đình Đạt", "Trần Trung Hiếu"],
  ["Phạm Minh Quân", "Nguyễn Văn Thành"],
  ["Nguyễn Đan Quyên", "Bùi Huyền Trang"],
  ["Nguyễn Tiến Trung", "Chu Văn Huynh"],
  ["Phạm Minh Quân", "Vương Mạnh Chuyền"],
  ["Nguyễn Đan Quyên", "Đặng Thị Nhung"],
  ["Nguyễn Đình Đạt", "Vương Mạnh Chuyền"],
  ["Phạm Minh Quân", "Nguyễn Tiến Trung"],
  ["Nguyễn Đan Quyên", "Lê Thanh Phương"],
  ["Nguyễn Văn Thành", "Nguyễn Tiến Trung"],
  ["Phạm Minh Quân", "Chu Văn Huynh"],
  ["Nguyễn Đan Quyên", "Vũ Ngọc Linh"],
  ["Nguyễn Đình Đạt", "Phạm Minh Quân"],
  ["Nguyễn Văn Thành", "Vương Mạnh Chuyền"],
  ["Nguyễn Đình Đạt", "Nguyễn Tiến Trung"],
  ["Phạm Minh Quân", "Trần Trung Hiếu"]
];
