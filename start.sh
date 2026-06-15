#!/bin/bash

# Скрипт запуска приложения Книготрек
# Автоматически проверяет зависимости и запускает приложение

set -e  # Остановка при ошибке

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Запуск приложения Книготрек${NC}"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo "Установите Node.js с https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js: ${NODE_VERSION}${NC}"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен!${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm: ${NPM_VERSION}${NC}"

# Проверка установки зависимостей
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
    npm install
    echo -e "${GREEN}✅ Зависимости установлены${NC}"
else
    echo -e "${GREEN}✅ Зависимости уже установлены${NC}"
fi

# Опциональная проверка перед запуском
if [ "$1" = "--check" ] || [ "$1" = "-c" ]; then
    echo ""
    echo -e "${YELLOW}🔍 Выполнение проверок перед запуском...${NC}"
    echo ""
    
    # Проверка типов
    echo -e "${YELLOW}📝 Проверка TypeScript...${NC}"
    if npm run type-check > /dev/null 2>&1; then
        echo -e "${GREEN}✅ TypeScript проверка пройдена${NC}"
    else
        echo -e "${RED}❌ Ошибки TypeScript!${NC}"
        echo "Запуск без проверки? (y/n)"
        read -r response
        if [ "$response" != "y" ]; then
            exit 1
        fi
    fi
    
    # Запуск тестов (быстро)
    echo -e "${YELLOW}🧪 Запуск тестов...${NC}"
    if npm run test:run > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Тесты пройдены${NC}"
    else
        echo -e "${YELLOW}⚠️  Некоторые тесты не прошли${NC}"
        echo "Продолжить запуск? (y/n)"
        read -r response
        if [ "$response" != "y" ]; then
            exit 1
        fi
    fi
    
    echo ""
fi

# Выбор режима запуска
echo ""
echo -e "${YELLOW}Выберите режим запуска:${NC}"
echo "1) Веб-версия (браузер) - npm run dev"
echo "2) Electron (десктопное приложение) - npm run electron:dev"
echo ""
read -p "Введите номер (1 или 2, по умолчанию 1): " mode

case $mode in
    2)
        echo ""
        echo -e "${YELLOW}🔧 Проверка нативных модулей для Electron...${NC}"
        # Пересборка better-sqlite3 для Electron (если нужно)
        if command -v electron-rebuild &> /dev/null || [ -f "node_modules/.bin/electron-rebuild" ]; then
            echo -e "${YELLOW}Пересборка better-sqlite3 для Electron...${NC}"
            npm run electron:rebuild 2>/dev/null || true
        fi
        echo ""
        echo -e "${GREEN}🖥️  Запуск Electron приложения...${NC}"
        echo ""
        npm run electron:dev
        ;;
    1|"")
        echo ""
        echo -e "${GREEN}🌐 Запуск веб-версии...${NC}"
        echo -e "${YELLOW}Приложение будет доступно по адресу: http://localhost:5173${NC}"
        echo ""
        npm run dev
        ;;
    *)
        echo -e "${RED}❌ Неверный выбор${NC}"
        exit 1
        ;;
esac
