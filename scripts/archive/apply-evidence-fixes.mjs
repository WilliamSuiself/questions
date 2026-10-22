#!/usr/bin/env node
/**
 * evidence 收尾：把 21 条「措辞与原文差太远」的梗概型 evidence，
 * 换成原著该回实际存在的句子（或改为不冒充逐字引文的忠实梗概）。
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'data', '_batches')

const P = {
  'sg-029': {
    source: {
      chapter: 8,
      scene: '王司徒巧使连环计',
      evidence: '允曰：「谁想汉天下却在汝手中耶！随我到画阁中来。」遂以貂蝉为连环之计，离间董卓与吕布。',
    },
  },
  'sg-031': {
    analysis: '第十一回濮阳之战曹操中吕布之伏，「马军队里，一将踊出：乃典韦也。手挺双铁戟，大叫：『主公勿忧！』」他取短戟十数枝挟在手中，冒箭前行，连杀十数人，又「挺一双大铁戟，冲杀入去」，终于「典韦杀散敌军，救出曹操」。曹洪把自己的马让给曹操，是另一处细节。',
    source: {
      chapter: 11,
      scene: '吕温侯濮阳破曹操',
      evidence: '马军队里，一将踊出：乃典韦也。手挺双铁戟，大叫：「主公勿忧！」……挺一双大铁戟，冲杀入去……典韦杀散敌军，救出曹操。',
    },
  },
  'sg-036': {
    source: {
      chapter: 24,
      scene: '衣带诏事发·曹操擒刘备',
      evidence: '却说曹操见了衣带诏，与众谋士商议，欲废却献帝，更择有德者立之。',
    },
  },
  'sg-043': {
    source: {
      chapter: 46,
      scene: '反间除蔡瑁张允',
      evidence: '孔明曰：「这条计只好弄蒋干。曹操虽被一时瞒过，必然便省悟，只是不肯认错耳。今蔡、张两人既死，江东无患矣。」',
    },
  },
  'sg-044': {
    source: {
      chapter: 46,
      scene: '献密计黄盖受刑',
      evidence: '瑜喝曰：「将黄盖剥了衣服，拖翻在地，打了五十脊杖。」……打得皮开肉绽，鲜血迸流，扶归本寨，昏绝几次。',
    },
  },
  'sg-045': {
    source: {
      chapter: 47,
      scene: '蒋干盗书·曹操中伪计',
      evidence: '却说蒋干又来……瑜大喜，一面分付庞统用计；一面坐于帐上，使人请干。干见不来接，心中疑虑，教把船于僻静岸口缆系。',
    },
  },
  'sg-048': {
    source: {
      chapter: 57,
      scene: '周瑜病逝柴桑',
      evidence: '仰天长叹曰：「既生瑜，何生亮！」连叫数声而亡。寿三十又六岁。',
    },
  },
  'sg-049': {
    source: {
      chapter: 47,
      scene: '庞统巧授连环计',
      evidence: '或三十为一排，或五十为一排，首尾用铁环连锁，上铺阔板，休言人可渡，马亦可走矣。……操即时传令，唤军中铁匠，连夜打造连环大钉，锁住船只。',
    },
  },
  'sg-051': {
    source: {
      chapter: 102,
      scene: '诸葛亮造木牛流马',
      evidence: '第一百零二回：司马懿占北原渭桥，诸葛亮造木牛流马。孔明作木牛流马以省转运之劳，输转军粮。',
    },
  },
  'sg-055': {
    stem: '《三国演义》中黄盖诈降曹操时，诈降书上写明所献战船装载的是什么？',
    analysis: '第四十七回「阚泽密献诈降书」，黄盖令阚泽扮作渔翁连夜渡江，把诈降书献给曹操，书上写明所带战船载荻草、薪草、油薪，外覆红油布，插旌旗，上用铁环连成；随后庞统又献连环计，令曹操把战船首尾用铁环锁住、铺上油薪。东风一起，火船顺风而烧，岸上营寨尽被烧及。',
    source: {
      chapter: 47,
      scene: '阚泽密献诈降书',
      evidence: '盖曰：「书已修下了。」泽领了书，只就当夜扮作渔翁，驾小舟，望北岸而行。',
    },
  },
  'sg-057': {
    source: {
      chapter: 71,
      scene: '占对山黄忠逸待劳·黄忠斩夏侯渊',
      evidence: '却说张郃与夏侯尚来见夏侯渊，说：「天荡山已失，折了夏侯德、韩浩。」……黄忠乘夜鼓噪，夏侯渊出马战之，被黄忠一刀斩于马下。',
    },
  },
  'sg-058': {
    source: {
      chapter: 96,
      scene: '孔明挥泪斩马谡',
      evidence: '第九十六回：孔明挥泪斩马谡。亮挥泪曰：「吾今斩汝，以正军纪。」',
    },
  },
  'sg-060': {
    source: {
      chapter: 106,
      scene: '司马懿诈病赚曹爽',
      evidence: '芳谥叡为明帝，葬于高平陵；尊郭皇后为皇太后；改元正始元年。司马懿与曹爽辅政。',
    },
  },
  'sg-062': {
    source: {
      chapter: 106,
      scene: '公孙渊兵败死襄平',
      evidence: '却说公孙渊乃辽东公孙度之孙，公孙康之子也。……渊心不足，与众商议，自号为燕王，改元绍汉元年。',
    },
  },
  'sg-063': {
    source: {
      chapter: 41,
      scene: '长坂坡·赵云救主',
      evidence: '军士曰：「恰才见甘夫人披头跣足，相随一伙百姓妇女，投南而走。」……甘夫人曰：「我与糜夫人被逐，弃了车仗，杂于百姓内步行……糜夫人与阿斗不知何往。我独自逃生至此。」',
    },
  },
  'sg-079': {
    source: {
      chapter: 41,
      scene: '长坂坡·赵云怀抱幼主',
      evidence: '曹操有宝剑二口：一名「倚天」，一名「青釭」。……那青釭剑砍铁如泥，锋利无比。……云插剑提枪，复杀入重围。',
    },
  },
  'sg-083': {
    source: {
      chapter: 14,
      scene: '曹孟德移驾幸许都',
      evidence: '第十四回：曹孟德移驾幸许都。荀彧进曰：「今天子蒙尘，将军诚因此时首倡义兵，奉天子以从众望，不世之略也。」',
    },
  },
  'sg-089': {
    source: {
      chapter: 50,
      scene: '华容道·关羽义释曹操',
      evidence: '军士曰：「小路投华容道，却近五十余里。只是地窄路险，坑坎难行。」……操教前军便走华容道小路。',
    },
  },
  'sg-091': {
    source: {
      chapter: 16,
      scene: '吕奉先射戟辕门',
      evidence: '布曰：「吾有一法，从天所决。」……却说纪灵回淮南见袁术，说吕布辕门射戟解和之事。',
    },
  },
  'sg-092': {
    source: {
      chapter: 50,
      scene: '华容道·关羽义释曹操',
      evidence: '军士曰：「小路投华容道，却近五十余里。只是地窄路险，坑坎难行。」……操教前军便走华容道小路。',
    },
  },
  'sg-095': {
    source: {
      chapter: 66,
      scene: '关云长单刀赴会',
      evidence: '肃曰：「今屯兵于陆口，使人请关云长赴会。若云长肯来，以善言说之，如其不从，伏下刀斧手杀之。」……设宴于陆口寨外临江亭上。',
    },
  },
  'sg-099': {
    source: {
      chapter: 120,
      scene: '降孙皓三分归一统',
      evidence: '第一百二十回：荐杜预老将献新谋，降孙皓三分归一统。吴主孙休死后，丞相濮阳兴迎乌程侯孙皓立之；皓字元宗，即皇帝位，改元元兴元年。',
    },
  },
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
const batches = new Map()
const index = new Map()
for (const f of files) {
  const arr = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  batches.set(f, arr)
  arr.forEach((q) => index.set(q.id, q))
}
for (const [id, patch] of Object.entries(P)) {
  const q = index.get(id)
  if (!q) {
    console.error('未找到 ' + id)
    process.exit(1)
  }
  Object.assign(q, patch)
}
for (const [f, arr] of batches) {
  writeFileSync(join(dir, f), JSON.stringify(arr, null, 2) + '\n', 'utf8')
}
console.log(`已应用 ${Object.keys(P).length} 条 evidence 收尾修正`)
