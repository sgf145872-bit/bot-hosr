import { Bot, Context } from 'grammy';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

// إعدادات البوت
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8097867469:AAFaAjWAOh_LgGHamjh5uUoKWLmYhNEgXpc';
const ADMIN_ID = parseInt(process.env.ADMIN_ID || '7881123172');

// بيانات التخزين
let groupsList: number[] = [];
let messagesList: string[] = [];

// إنشاء تطبيق البوت
const bot = new Bot(TOKEN);

// تحميل البيانات من الملفات
async function loadData(): Promise<void> {
  try {
    if (existsSync('/tmp/groups.txt')) {
      const data = await readFile('/tmp/groups.txt', 'utf-8');
      groupsList = data.split('\n').filter(line => line.trim()).map(line => parseInt(line.trim()));
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }

  try {
    if (existsSync('/tmp/messages.txt')) {
      const data = await readFile('/tmp/messages.txt', 'utf-8');
      messagesList = data.split('\n').filter(line => line.trim());
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// حفظ البيانات في الملفات
async function saveData(): Promise<void> {
  try {
    await writeFile('/tmp/groups.txt', groupsList.join('\n'));
  } catch (error) {
    console.error('Error saving groups:', error);
  }

  try {
    await writeFile('/tmp/messages.txt', messagesList.join('\n'));
  } catch (error) {
    console.error('Error saving messages:', error);
  }
}

// التحقق من مالك البوت
function isOwner(userId: number): boolean {
  return userId === ADMIN_ID;
}

// إضافة مجموعة/قناة إلى القائمة
bot.command('addgroup', async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const chatId = ctx.chat?.id;
  if (chatId && !groupsList.includes(chatId)) {
    groupsList.push(chatId);
    await saveData();
    await ctx.reply("✅ تمت إضافة المجموعة/القناة بنجاح!");
  } else {
    await ctx.reply("ℹ️ المجموعة/القناة موجودة بالفعل!");
  }
});

// إزالة مجموعة/قناة من القائمة
bot.command('removegroup', async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const chatId = ctx.chat?.id;
  if (chatId && groupsList.includes(chatId)) {
    groupsList = groupsList.filter(id => id !== chatId);
    await saveData();
    await ctx.reply("✅ تمت إزالة المجموعة/القناة بنجاح!");
  } else {
    await ctx.reply("ℹ️ المجموعة/القناة غير موجودة!");
  }
});

// إضافة رسالة مزخرفة
bot.command('addmessage', async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const message = ctx.match;
  if (!message) {
    await ctx.reply("⚠️ يرجى كتابة الرسالة!");
    return;
  }

  messagesList.push(message);
  await saveData();
  await ctx.reply("✅ تمت إضافة الرسالة المزخرفة بنجاح!");
});

// إزالة رسالة مزخرفة
bot.command('removemessage', async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const indexStr = ctx.match;
  if (!indexStr) {
    await ctx.reply("⚠️ يرجى تحديد رقم الرسالة!");
    return;
  }

  try {
    const index = parseInt(indexStr) - 1;
    if (index >= 0 && index < messagesList.length) {
      const removed = messagesList.splice(index, 1)[0];
      await saveData();
      await ctx.reply(`✅ تمت إزالة الرسالة:\n${removed}`);
    } else {
      await ctx.reply("⚠️ رقم الرسالة غير صالح!");
    }
  } catch (error) {
    await ctx.reply("⚠️ يرجى إدخال رقم صحيح!");
  }
});

// عرض قائمة الرسائل المزخرفة
bot.command('listmessages', async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  if (messagesList.length === 0) {
    await ctx.reply("ℹ️ لا توجد رسائل مزخرفة!");
    return;
  }

  let msg = "📜 قائمة الرسائل المزخرفة:\n\n";
  messagesList.forEach((message, i) => {
    msg += `${i + 1}. ${message}\n`;
  });

  await ctx.reply(msg);
});

// معالج الطلبات لـ Vercel
export default async function handler(req: any, res: any) {
  try {
    // تحميل البيانات عند كل طلب لأن Vercel يعمل بطريقة serverless
    await loadData();
    
    const { body } = req;
    await bot.handleUpdate(body);
    res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error('Error handling update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// تشغيل البوت عند الاستيراد
loadData().then(() => {
  console.log("✅ تم تحميل البيانات بنجاح");
}).catch(console.error);
