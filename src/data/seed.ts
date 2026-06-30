import type { Entry } from "../config/types";

// 首次进入时的"已经住了很久"的内容种子——让空间一上来就有人住过的密度，
// 也给探索以回报（书架点亮、陈列柜有物、唱片架有歌）。这些仍是普通 Entry，
// 落盘后用户可增删改；删光也不会再生（只在世界从未保存过时注入一次）。
//
// 主题锚点：镜面水 / 星空 / 潮汐 / 旧书 / 把记忆当作水来盛放 / 内省。
const DAY = 86400000;

interface Spec {
  id: string;
  zoneId: string;
  type: Entry["type"];
  title: string;
  body: string;
  primitive?: Entry["primitive"];
  color?: string;
  ageDays: number;
}

const SPECS: Spec[] = [
  // —— 书墙 · 思考 ——
  { id: "seed-t1", zoneId: "zone-bookshelf", type: "thought", ageDays: 41,
    title: "把记忆当作水来盛放",
    body: "想留住的越攥越漏，松开手反而留下了。后来我不再去抓，只让它们沉到水里——需要时，涨潮自会把它们送回来。" },
  { id: "seed-t2", zoneId: "zone-bookshelf", type: "thought", ageDays: 33,
    title: "关于留白",
    body: "一直想把每天填满，后来发现真正记得住的，都是那些没安排的、发呆的、看水面发亮的间隙。留白不是浪费，是给自己留一个能回来的地方。" },
  { id: "seed-t3", zoneId: "zone-bookshelf", type: "thought", ageDays: 21,
    title: "深夜比白天诚实",
    body: "白天我会说‘还行’，到了凌晨才肯承认其实不行。也许内心世界本来就只在灯都灭了、水都静了以后才开门。" },
  { id: "seed-t4", zoneId: "zone-bookshelf", type: "thought", ageDays: 12,
    title: "为什么总到水上来",
    body: "岸上是要见人的我，水上是只对自己说话的我。踏上镜面那一步，像一个小小的仪式：把外面的角色一层层留在岸边的台阶上。" },
  { id: "seed-t5", zoneId: "zone-bookshelf", type: "thought", ageDays: 5,
    title: "一段旋律如何记住一个人",
    body: "有些人走了，留下一首歌。此后每次响起，他们就在副歌里短暂地活过来一次。音乐是我偷偷保存故人的方式。" },
  { id: "seed-t6", zoneId: "zone-bookshelf", type: "thought", ageDays: 1,
    title: "今天什么都没做",
    body: "泡了茶，听完一整张唱片，看星星在脚下的水里轻轻晃。什么都没做，却觉得久违地像个人。把这一天也记下来，因为它值得。" },

  // —— 浮岛陈列 · 珍视之物 ——
  { id: "seed-o1", zoneId: "zone-objects", type: "object", ageDays: 60, primitive: "cylinder", color: "#caa05a",
    title: "一只停摆的怀表",
    body: "外公的。指针停在三点十七分，没人知道为什么。我也没修——有些时间，停住反而更像永远。" },
  { id: "seed-o2", zoneId: "zone-objects", type: "object", ageDays: 47, primitive: "box", color: "#2a3550",
    title: "蓝墨水钢笔",
    body: "第一份工资买的。写坏过三本日记，漏过一次墨，弄脏过一封没敢寄出的信。它见过我最不体面的句子。" },
  { id: "seed-o3", zoneId: "zone-objects", type: "object", ageDays: 30, primitive: "sphere", color: "#73767e",
    title: "海边的灰石头",
    body: "和谁去的已经记不清，石头却一直在。它什么也不说，只是凉，只是沉，提醒我那天真的存在过。如今它就摆在水边，像一句不肯化开的句号。" },
  { id: "seed-o4", zoneId: "zone-objects", type: "object", ageDays: 16, primitive: "box", color: "#7a3330",
    title: "一张电影票根",
    body: "散场时外面在下雨，我们站在屋檐下没说话，等雨小。其实是舍不得那场雨结束。" },
  { id: "seed-o5", zoneId: "zone-objects", type: "object", ageDays: 3, primitive: "cylinder", color: "#b08d57",
    title: "祖母的顶针",
    body: "她缝东西时总把它戴在中指。如今它太小，谁的手指都进不去，却装得下一整个有人替我缝补的童年。" },

  // —— 留声机 · 影音（作为‘此刻心境曲’的记忆，不依赖外链）——
  { id: "seed-r1", zoneId: "zone-record", type: "track", ageDays: 38,
    title: "夜与水 · 钢琴即兴",
    body: "正在循环的这张。没有歌词，只有一架钢琴和水面的微光在轮流说话。最适合什么都不想的时候。" },
  { id: "seed-r2", zoneId: "zone-record", type: "track", ageDays: 25,
    title: "凌晨四点的萨克斯",
    body: "城市睡着的时候，这首醒着。像有人在隔壁房间替你失眠，于是你也没那么孤单。" },
  { id: "seed-r3", zoneId: "zone-record", type: "track", ageDays: 9,
    title: "她常哼的调子",
    body: "记不全词，只记得旋律会在做饭、走神、等红灯时自己冒出来。" },
];

export function makeSeed(now: number): Entry[] {
  return SPECS.map((s) => ({
    id: s.id,
    zoneId: s.zoneId,
    type: s.type,
    title: s.title,
    body: s.body,
    primitive: s.primitive,
    color: s.color,
    createdAt: now - s.ageDays * DAY,
    updatedAt: now - s.ageDays * DAY,
  }));
}
